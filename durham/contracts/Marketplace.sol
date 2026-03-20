// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Marketplace
 * @dev Decentralized marketplace for buying/selling property shares
 * Supports ADI token payments with 2% platform fee
 */
contract Marketplace is ReentrancyGuard, Ownable {
    address public platformWallet;
    uint256 public platformFeePercent = 2; // 2%

    struct Listing {
        address seller;
        address shareToken;
        uint256 amount;
        uint256 pricePerShare; // In wei (ADI tokens)
        bool isActive;
        uint256 listedAt;
    }

    mapping(bytes32 => Listing) public listings;
    bytes32[] public allListingIds;

    event SharesListed(
        bytes32 indexed listingId,
        address indexed seller,
        address indexed shareToken,
        uint256 amount,
        uint256 pricePerShare
    );

    event SharesPurchased(
        bytes32 indexed listingId,
        address indexed buyer,
        address indexed seller,
        address shareToken,
        uint256 amount,
        uint256 totalPrice,
        uint256 platformFee
    );

    event ListingCancelled(
        bytes32 indexed listingId,
        address indexed seller
    );

    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event PlatformWalletUpdated(address oldWallet, address newWallet);

    constructor(address _platformWallet) {
        require(_platformWallet != address(0), "Invalid platform wallet");
        platformWallet = _platformWallet;
    }

    /**
     * @dev List shares for sale
     */
    function listShares(
        address shareToken,
        uint256 amount,
        uint256 pricePerShare
    ) external nonReentrant returns (bytes32) {
        require(shareToken != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        require(pricePerShare > 0, "Price must be greater than 0");

        // Check seller has enough shares
        IERC20 token = IERC20(shareToken);
        require(
            token.balanceOf(msg.sender) >= amount,
            "Insufficient share balance"
        );

        // Generate unique listing ID
        bytes32 listingId = keccak256(
            abi.encodePacked(
                msg.sender,
                shareToken,
                amount,
                pricePerShare,
                block.timestamp
            )
        );

        // Create listing
        listings[listingId] = Listing({
            seller: msg.sender,
            shareToken: shareToken,
            amount: amount,
            pricePerShare: pricePerShare,
            isActive: true,
            listedAt: block.timestamp
        });

        allListingIds.push(listingId);

        // Transfer shares to marketplace for escrow
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Share transfer failed"
        );

        emit SharesListed(
            listingId,
            msg.sender,
            shareToken,
            amount,
            pricePerShare
        );

        return listingId;
    }

    /**
     * @dev Purchase shares from a listing
     */
    function purchaseShares(bytes32 listingId)
        external
        payable
        nonReentrant
    {
        Listing storage listing = listings[listingId];
        require(listing.isActive, "Listing is not active");
        require(listing.seller != msg.sender, "Cannot buy your own listing");

        uint256 totalPrice = listing.amount * listing.pricePerShare;
        require(msg.value >= totalPrice, "Insufficient payment");

        // Calculate platform fee
        uint256 platformFee = (totalPrice * platformFeePercent) / 100;
        uint256 sellerAmount = totalPrice - platformFee;

        // Mark listing as inactive
        listing.isActive = false;

        // Transfer shares to buyer
        IERC20 token = IERC20(listing.shareToken);
        require(
            token.transfer(msg.sender, listing.amount),
            "Share transfer to buyer failed"
        );

        // Transfer payment to seller
        (bool sellerSuccess, ) = payable(listing.seller).call{value: sellerAmount}("");
        require(sellerSuccess, "Payment to seller failed");

        // Transfer platform fee
        (bool feeSuccess, ) = payable(platformWallet).call{value: platformFee}("");
        require(feeSuccess, "Platform fee transfer failed");

        // Refund excess payment
        if (msg.value > totalPrice) {
            uint256 refund = msg.value - totalPrice;
            (bool refundSuccess, ) = payable(msg.sender).call{value: refund}("");
            require(refundSuccess, "Refund failed");
        }

        emit SharesPurchased(
            listingId,
            msg.sender,
            listing.seller,
            listing.shareToken,
            listing.amount,
            totalPrice,
            platformFee
        );
    }

    /**
     * @dev Cancel a listing and return shares to seller
     */
    function cancelListing(bytes32 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.isActive, "Listing is not active");
        require(listing.seller == msg.sender, "Only seller can cancel");

        // Mark as inactive
        listing.isActive = false;

        // Return shares to seller
        IERC20 token = IERC20(listing.shareToken);
        require(
            token.transfer(msg.sender, listing.amount),
            "Share return failed"
        );

        emit ListingCancelled(listingId, msg.sender);
    }

    /**
     * @dev Get active listings for a share token
     */
    function getActiveListings(address shareToken)
        external
        view
        returns (bytes32[] memory)
    {
        uint256 activeCount = 0;

        // Count active listings
        for (uint256 i = 0; i < allListingIds.length; i++) {
            bytes32 listingId = allListingIds[i];
            Listing memory listing = listings[listingId];
            if (listing.isActive && listing.shareToken == shareToken) {
                activeCount++;
            }
        }

        // Populate result array
        bytes32[] memory result = new bytes32[](activeCount);
        uint256 index = 0;

        for (uint256 i = 0; i < allListingIds.length; i++) {
            bytes32 listingId = allListingIds[i];
            Listing memory listing = listings[listingId];
            if (listing.isActive && listing.shareToken == shareToken) {
                result[index] = listingId;
                index++;
            }
        }

        return result;
    }

    /**
     * @dev Get all active listings
     */
    function getAllActiveListings() external view returns (bytes32[] memory) {
        uint256 activeCount = 0;

        for (uint256 i = 0; i < allListingIds.length; i++) {
            if (listings[allListingIds[i]].isActive) {
                activeCount++;
            }
        }

        bytes32[] memory result = new bytes32[](activeCount);
        uint256 index = 0;

        for (uint256 i = 0; i < allListingIds.length; i++) {
            bytes32 listingId = allListingIds[i];
            if (listings[listingId].isActive) {
                result[index] = listingId;
                index++;
            }
        }

        return result;
    }

    /**
     * @dev Update platform fee percentage (owner only)
     */
    function updatePlatformFee(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= 10, "Fee cannot exceed 10%");
        uint256 oldFee = platformFeePercent;
        platformFeePercent = newFeePercent;
        emit PlatformFeeUpdated(oldFee, newFeePercent);
    }

    /**
     * @dev Update platform wallet address (owner only)
     */
    function updatePlatformWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "Invalid address");
        address oldWallet = platformWallet;
        platformWallet = newWallet;
        emit PlatformWalletUpdated(oldWallet, newWallet);
    }

    /**
     * @dev Get total number of listings (active + inactive)
     */
    function totalListings() external view returns (uint256) {
        return allListingIds.length;
    }

    /**
     * @dev Get listing details
     */
    function getListing(bytes32 listingId)
        external
        view
        returns (
            address seller,
            address shareToken,
            uint256 amount,
            uint256 pricePerShare,
            bool isActive,
            uint256 listedAt
        )
    {
        Listing memory listing = listings[listingId];
        return (
            listing.seller,
            listing.shareToken,
            listing.amount,
            listing.pricePerShare,
            listing.isActive,
            listing.listedAt
        );
    }
}
