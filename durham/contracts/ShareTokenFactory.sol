// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ShareToken
 * @dev ERC-20 token representing fractional ownership shares of a property
 * 1000 shares per property, 0 decimals (whole shares only)
 */
contract ShareToken is ERC20 {
    uint256 public parcelTokenId;
    address public parcelNFTContract;
    uint256 public constant TOTAL_SHARES = 1000;
    uint8 private constant DECIMALS = 0;

    constructor(
        string memory name,
        string memory symbol,
        uint256 _parcelTokenId,
        address _parcelNFTContract,
        address initialOwner
    ) ERC20(name, symbol) {
        parcelTokenId = _parcelTokenId;
        parcelNFTContract = _parcelNFTContract;
        _mint(initialOwner, TOTAL_SHARES);
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
}

/**
 * @title ShareTokenFactory
 * @dev Factory contract to create share tokens for tokenized properties
 */
contract ShareTokenFactory is Ownable {
    address public countyAdmin;
    address public parcelNFTContract;

    struct TokenInfo {
        address tokenAddress;
        uint256 parcelTokenId;
        address creator;
        uint256 createdAt;
    }

    mapping(uint256 => address) public shareTokenByParcelId;
    mapping(address => TokenInfo) public tokenInfo;
    address[] public allShareTokens;

    event ShareTokenCreated(
        address indexed tokenAddress,
        uint256 indexed parcelTokenId,
        address indexed creator,
        string symbol
    );

    constructor(address _countyAdmin, address _parcelNFTContract)
    {
        require(_countyAdmin != address(0), "Invalid county admin");
        require(_parcelNFTContract != address(0), "Invalid parcel contract");

        countyAdmin = _countyAdmin;
        parcelNFTContract = _parcelNFTContract;
    }

    modifier onlyCounty() {
        require(
            msg.sender == countyAdmin || msg.sender == owner(),
            "Only county admin can execute"
        );
        _;
    }

    /**
     * @dev Create share tokens for a property parcel
     * @param parcelTokenId The NFT token ID from ParcelNFT contract
     * @param pin Property Identification Number (for naming)
     * @param owner Initial owner who receives all 1000 shares
     */
    function createShareToken(
        uint256 parcelTokenId,
        string memory pin,
        address owner
    ) external onlyCounty returns (address) {
        require(owner != address(0), "Invalid owner address");
        require(
            shareTokenByParcelId[parcelTokenId] == address(0),
            "Share token already exists for this parcel"
        );

        // Create token name and symbol from PIN
        string memory name = string(abi.encodePacked("Durham Parcel ", pin));
        string memory symbol = string(abi.encodePacked("DUR-", pin));

        // Deploy new ShareToken contract
        ShareToken newToken = new ShareToken(
            name,
            symbol,
            parcelTokenId,
            parcelNFTContract,
            owner
        );

        address tokenAddress = address(newToken);

        // Store mapping
        shareTokenByParcelId[parcelTokenId] = tokenAddress;
        tokenInfo[tokenAddress] = TokenInfo({
            tokenAddress: tokenAddress,
            parcelTokenId: parcelTokenId,
            creator: msg.sender,
            createdAt: block.timestamp
        });
        allShareTokens.push(tokenAddress);

        emit ShareTokenCreated(tokenAddress, parcelTokenId, msg.sender, symbol);

        return tokenAddress;
    }

    /**
     * @dev Get share token address for a parcel
     */
    function getShareToken(uint256 parcelTokenId) external view returns (address) {
        return shareTokenByParcelId[parcelTokenId];
    }

    /**
     * @dev Get all created share tokens
     */
    function getAllShareTokens() external view returns (address[] memory) {
        return allShareTokens;
    }

    /**
     * @dev Get token info by address
     */
    function getTokenInfo(address tokenAddress) external view returns (
        uint256 parcelTokenId,
        address creator,
        uint256 createdAt
    ) {
        TokenInfo memory info = tokenInfo[tokenAddress];
        return (info.parcelTokenId, info.creator, info.createdAt);
    }

    /**
     * @dev Update county admin (owner only)
     */
    function updateCountyAdmin(address newAdmin) external onlyOwner {
        require(newAdmin != address(0), "Invalid address");
        countyAdmin = newAdmin;
    }

    /**
     * @dev Total number of share tokens created
     */
    function totalShareTokens() external view returns (uint256) {
        return allShareTokens.length;
    }
}
