// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ParcelNFT
 * @dev ERC-721 NFT contract for Durham County property parcels
 * Each NFT represents a verified property deed
 */
contract ParcelNFT is ERC721, Ownable {
    uint256 private _tokenIdCounter;
    address public countyAdmin;

    struct Parcel {
        string pin;           // Property Identification Number
        string deedHash;      // IPFS hash of deed PDF
        string geojson;       // GeoJSON polygon data
        address verifiedBy;   // County admin who verified
        uint256 verifiedAt;   // Timestamp of verification
        uint256 shareTokenId; // Associated share token contract (0 if not tokenized)
    }

    mapping(uint256 => Parcel) public parcels;
    mapping(string => uint256) public tokenIdByPin;
    mapping(string => bool) public pinExists;

    event ParcelMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string pin,
        string deedHash,
        address verifiedBy
    );

    event ShareTokenLinked(
        uint256 indexed tokenId,
        address indexed shareToken
    );

    constructor(address _countyAdmin)
        ERC721("Durham County Deeds", "DURHAM")
    {
        require(_countyAdmin != address(0), "Invalid county admin address");
        countyAdmin = _countyAdmin;
    }

    modifier onlyCounty() {
        require(
            msg.sender == countyAdmin || msg.sender == owner(),
            "Only county admin can execute"
        );
        _;
    }

    /**
     * @dev Mint a new parcel NFT (county admin only)
     */
    function mintParcel(
        address to,
        string memory pin,
        string memory deedHash,
        string memory geojson
    ) public onlyCounty returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(!pinExists[pin], "PIN already minted");
        require(bytes(pin).length > 0, "PIN cannot be empty");
        require(bytes(deedHash).length > 0, "Deed hash cannot be empty");

        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;
        _safeMint(to, tokenId);

        parcels[tokenId] = Parcel({
            pin: pin,
            deedHash: deedHash,
            geojson: geojson,
            verifiedBy: msg.sender,
            verifiedAt: block.timestamp,
            shareTokenId: 0
        });

        tokenIdByPin[pin] = tokenId;
        pinExists[pin] = true;

        emit ParcelMinted(tokenId, to, pin, deedHash, msg.sender);

        return tokenId;
    }

    /**
     * @dev Link share token contract to parcel (called by ShareTokenFactory)
     */
    function linkShareToken(uint256 tokenId, uint256 shareTokenId) external {
        require(_exists(tokenId), "Token does not exist");
        require(parcels[tokenId].shareTokenId == 0, "Share token already linked");

        parcels[tokenId].shareTokenId = shareTokenId;

        emit ShareTokenLinked(tokenId, msg.sender);
    }

    /**
     * @dev Get parcel details by PIN
     */
    function getParcelByPin(string memory pin) external view returns (
        uint256 tokenId,
        address owner,
        string memory deedHash,
        string memory geojson,
        address verifiedBy,
        uint256 verifiedAt,
        uint256 shareTokenId
    ) {
        require(pinExists[pin], "PIN does not exist");

        tokenId = tokenIdByPin[pin];
        Parcel memory parcel = parcels[tokenId];

        return (
            tokenId,
            ownerOf(tokenId),
            parcel.deedHash,
            parcel.geojson,
            parcel.verifiedBy,
            parcel.verifiedAt,
            parcel.shareTokenId
        );
    }

    /**
     * @dev Update county admin address (owner only)
     */
    function updateCountyAdmin(address newAdmin) external onlyOwner {
        require(newAdmin != address(0), "Invalid address");
        countyAdmin = newAdmin;
    }

    /**
     * @dev Get total number of minted parcels
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }
}
