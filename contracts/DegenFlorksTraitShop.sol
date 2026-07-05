// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDegenFlorks {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title Degen Florks Trait Shop
/// @notice Lets holders purchase cosmetic traits for their Florks.
///         Ownership of traits is recorded on-chain via events + storage;
///         the actual image/metadata composition happens off-chain (backend
///         listens to TraitPurchased events and updates Supabase + tokenURI API).
contract DegenFlorksTraitShop {
    address public owner;
    IDegenFlorks public florksContract;

    // traitId => price in wei
    mapping(uint256 => uint256) public traitPrice;
    // traitId => active (purchasable)
    mapping(uint256 => bool) public traitActive;
    // tokenId => traitId => owned
    mapping(uint256 => mapping(uint256 => bool)) public ownsTrait;

    event TraitPurchased(uint256 indexed tokenId, uint256 indexed traitId, address indexed buyer, uint256 amount);
    event TraitPriceSet(uint256 indexed traitId, uint256 price, bool active);
    event Withdrawn(address to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _florksContract) {
        owner = msg.sender;
        florksContract = IDegenFlorks(_florksContract);
    }

    /// @notice Owner sets or updates a trait's price and availability.
    function setTrait(uint256 traitId, uint256 priceWei, bool active) external onlyOwner {
        traitPrice[traitId] = priceWei;
        traitActive[traitId] = active;
        emit TraitPriceSet(traitId, priceWei, active);
    }

    function setTraitsBatch(uint256[] calldata traitIds, uint256[] calldata prices, bool[] calldata actives) external onlyOwner {
        require(traitIds.length == prices.length && prices.length == actives.length, "Length mismatch");
        for (uint256 i = 0; i < traitIds.length; i++) {
            traitPrice[traitIds[i]] = prices[i];
            traitActive[traitIds[i]] = actives[i];
            emit TraitPriceSet(traitIds[i], prices[i], actives[i]);
        }
    }

    /// @notice Purchase a trait for a Flork you own.
    function purchaseTrait(uint256 tokenId, uint256 traitId) external payable {
        require(traitActive[traitId], "Trait not available");
        require(msg.value >= traitPrice[traitId], "Insufficient payment");
        require(florksContract.ownerOf(tokenId) == msg.sender, "Not your Flork");
        require(!ownsTrait[tokenId][traitId], "Already owned");

        ownsTrait[tokenId][traitId] = true;
        emit TraitPurchased(tokenId, traitId, msg.sender, msg.value);

        // Refund overpayment, if any
        uint256 refund = msg.value - traitPrice[traitId];
        if (refund > 0) {
            (bool sent, ) = msg.sender.call{value: refund}("");
            require(sent, "Refund failed");
        }
    }

    function withdraw(address to) external onlyOwner {
        uint256 balance = address(this).balance;
        (bool sent, ) = to.call{value: balance}("");
        require(sent, "Withdraw failed");
        emit Withdrawn(to, balance);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}
