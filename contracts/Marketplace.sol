// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol";

contract Marketplace is ERC20 {
  address private owner;

  mapping (address => person) private users;
  mapping (uint => product) private products;
  mapping (uint => mapping(address => uint)) private funds;
  mapping (uint => uint) private productsFunds;

  mapping (address => freelenceProduct[]) private productsFreelencers;
  mapping (uint => uint) private productsDevFunds;

  mapping (uint => address[]) registeredFreelancers;
  mapping (uint => address[]) teams;

  mapping (uint => notification) notifications;
  mapping (address => notificationWithState[]) managerNotifications;

  uint private nrProducts = 0;
  uint private nrNotifications = 0;
  uint private DEFAULT_REPUTATION = 5;

  enum roles { MANAGER, FREELANCER, EVALUATOR, FINANCER }
  enum states { BACKLOG, IN_PROGRESS, DONE }
  enum notificationStatus { PENDING, ACCEPTED, DENIED }

  event productDone(address, address, uint);

  struct person {
    string name;
    uint reputation;
    string category;
    roles role;
    bool isActive;
  }

  struct product {
    string description;
    uint DEV;
    uint REV;
    string domain;
    address manager;
    address evaluator;
    bool hasSufficientFunds;
    contributors productContributors;
    states state;
  }

  struct freelenceProduct {
    uint productId;
    uint amount;
  }

  struct contributors {
    address [] values;
    mapping (address => bool) isIn;
  }

  struct notification {
    address senderFreelancer;
    uint productId;
    string msg;
  }

  struct notificationWithState {
    uint notificationId;
    notificationStatus status;
  }

  modifier onlyOwner() {
    require(msg.sender == owner, "Must be the owner!");
    _;
  }

  modifier onlyEvaluator() {
    require(users[msg.sender].role == roles.EVALUATOR, "Must be EVALUATOR!");
    _;
  }

  modifier onlyFreelancer() {
    require(users[msg.sender].role == roles.FREELANCER, "Must be FREELANCER!");
    _;
  }

  modifier onlyManager() {
    require(users[msg.sender].role == roles.MANAGER, "Must be MANAGER!");
    _;
  }

  modifier onlyFinancer() {
    require(users[msg.sender].role == roles.FINANCER, "Must be FINANCER!");
    _;
  }

  modifier validUser() {
    require(users[msg.sender].isActive == true, "User not found!");
    _;
  }

  modifier validUserAddress(address userAddress) {
    require(users[userAddress].isActive == true, "User not found!");
    _;
  }

  modifier insufficientFunds(uint productId) {
    require(products[productId].hasSufficientFunds == false, "Product reached the fund goal!");
    _;
  }

  modifier productExists(uint productId) {
    require(products[productId].manager != address(0x0), "Product doesn't exists!");
    _;
  }

  modifier notificationExists(uint notificationId) {
    require(notifications[notificationId].senderFreelancer != address(0x0), "Notification doesn't exists!");
    _;
  }

  constructor () public ERC20("Token", "TKN") {
    owner = msg.sender;
  }

  function addManager(address userAddress, string memory name) public onlyOwner {
    require(users[userAddress].isActive == false, "User exists!");
    users[userAddress] = person(name, DEFAULT_REPUTATION, "", roles.MANAGER, true);
  }

  function addFreelencer(address userAddress, string memory name, string memory category) public onlyOwner {
    require(users[userAddress].isActive == false, "User exists!");
    users[userAddress] = person(name, DEFAULT_REPUTATION, category, roles.FREELANCER, true);
  }

  function addEvaluator(address userAddress, string memory name, string memory category) public onlyOwner {
    require(users[userAddress].isActive == false, "User exists!");
    users[userAddress] = person(name, DEFAULT_REPUTATION, category, roles.EVALUATOR, true);
  }

  function addFinancer(address userAddress, string memory name) public onlyOwner {
    require(users[userAddress].isActive == false, "User exists!");
    users[userAddress] = person(name, DEFAULT_REPUTATION, "", roles.FINANCER, true);
    _mint(userAddress, 10000 * (10 ** uint256(decimals())));
  }

  function getUser() public view returns(string memory, uint, string memory, roles) {
    require(users[msg.sender].isActive == true, "User not found!");
    return (users[msg.sender].name, users[msg.sender].reputation, users[msg.sender].category, users[msg.sender].role);
  }

  function getUserDetails(address userAddress) public view returns(string memory, uint, string memory, roles) {
    require(users[userAddress].isActive == true, "User not found!");
    return (users[userAddress].name, users[userAddress].reputation, users[userAddress].category, users[userAddress].role);
  }

  function createProduct(string memory description, uint DEV, uint REV, string memory domain) public validUser onlyManager {
    contributors memory contrib = contributors(new address[](10));
    products[nrProducts] = product(description, DEV, REV, domain, msg.sender, address(0x0), false, contrib, states.BACKLOG);
    nrProducts++;
  }

  function getProducts() public view returns (uint[] memory) {
    uint[] memory validProducts = new uint[](nrProducts);

    for(uint i = 0; i < nrProducts; i++) {
      if(products[i].manager != address(0x0)) {
        validProducts[i] = i;
      }
    }

    return validProducts;
  }

  function getProduct(uint productId) public view returns (string memory, uint, uint, string memory, address, address, bool, states) {
    product storage currentProduct = products[productId];
    return (currentProduct.description, currentProduct.DEV, currentProduct.REV, currentProduct.domain, currentProduct.manager, currentProduct.evaluator, currentProduct.hasSufficientFunds, currentProduct.state);
  }

  function deleteProduct(uint productId) public validUser productExists(productId) onlyManager {
    require(products[productId].manager == msg.sender, "Only the product owner can delete a product!");
    require(!products[productId].hasSufficientFunds, "Cannot delete after the funding finished!");

    for(uint i = 0; i < products[productId].productContributors.values.length; i++) {
      address financer = products[productId].productContributors.values[i];

      if(funds[productId][financer] > 0) {
        transferFrom(owner, financer, funds[productId][financer]);

        funds[productId][financer] = 0;
      }
    }

    productsFunds[productId] = 0;
    delete products[productId];
  }

  function financeProduct(uint productId, uint value) public validUser onlyFinancer productExists(productId) insufficientFunds(productId) {
    uint devPrice = products[productId].REV + products[productId].DEV;

    if (value + productsFunds[productId] == devPrice) {
      transfer(owner, value);

      productsFunds[productId] += value;
      products[productId].hasSufficientFunds = true;
      funds[productId][msg.sender] += value;
    } else if (value + productsFunds[productId] < devPrice) {
      transfer(owner, value);

      productsFunds[productId] += value;
      funds[productId][msg.sender] += value;
    } else {
      uint diff = devPrice - funds[productId][msg.sender];
      transfer(owner, diff);

      productsFunds[productId] = devPrice;
      funds[productId][msg.sender] += diff;
      products[productId].hasSufficientFunds = true;
    }

    if(!products[productId].productContributors.isIn[msg.sender]) {
      products[productId].productContributors.values.push(msg.sender);
      products[productId].productContributors.isIn[msg.sender] = true;
    }
  }

  function withdrawFundsFromProduct(uint productId, uint value) public validUser onlyFinancer productExists(productId) insufficientFunds(productId) {
    require(funds[productId][msg.sender] >= value, "Not enough funds to withdraw");
    require(products[productId].productContributors.isIn[msg.sender], "Not a contributor!");

    transferFrom(owner, msg.sender, value);

    productsFunds[productId] -= value;
    funds[productId][msg.sender] -= value;

    if (funds[productId][msg.sender] == 0) {
      for(uint i = 0; i < products[productId].productContributors.values.length; i++) {
        if (products[productId].productContributors.values[i] == msg.sender) {
          delete products[productId].productContributors.values[i];
          products[productId].productContributors.isIn[msg.sender] = false;

          break;
        }
      }
    }
  }

  function addEvaluator(uint productId) public validUser productExists(productId) onlyEvaluator {
    require(products[productId].evaluator == address(0x0), "The product already have an evaluator!");
    products[productId].evaluator = msg.sender;
  }

  function addFreelencer(uint productId, uint value) public validUser productExists(productId) onlyFreelancer {
    require(products[productId].DEV <= value, "The value is bigger than DEV!");

    freelenceProduct[] memory freelancerProducts = productsFreelencers[msg.sender];

    for (uint i = 0; i < freelancerProducts.length; i++) {
      if (freelancerProducts[i].productId == productId) {
        revert("Already signed on this product!");
      }
    }

    freelenceProduct memory freeProd = freelenceProduct(productId, value);
    productsFreelencers[msg.sender].push(freeProd);
    registeredFreelancers[productId].push(msg.sender);
  }

  function getFreelancers(uint productId) public view productExists(productId) onlyManager returns(address[] memory) {
    return registeredFreelancers[productId];
  }

  function addToTeam(uint productId, address freelancerAddress) public productExists(productId) validUserAddress(freelancerAddress) onlyManager {
    require(products[productId].state == states.BACKLOG, "The project already started!");

    address[] memory members = teams[productId];

    for (uint i = 0; i < members.length; i++) {
      if (members[i] == freelancerAddress) {
        revert("Freelancer already added!");
      }
    }

    freelenceProduct[] memory selectedProducts = productsFreelencers[freelancerAddress];

    for (uint i = 0; i < selectedProducts.length; i++) {
      if (selectedProducts[i].productId == productId) {
        if (productsDevFunds[productId] + selectedProducts[i].amount > products[productId].DEV) {
          revert("Maximum DEV exceeded!");
        }

        productsDevFunds[productId] += selectedProducts[i].amount;
        teams[productId].push(freelancerAddress);

        if (productsDevFunds[productId] == products[productId].DEV) {
          products[productId].state = states.IN_PROGRESS;
        }

        break;
      }
    }
  }

  function notifyManagerDoneProduct(uint productId) public productExists(productId) validUser onlyFreelancer{
    address manager = products[productId].manager;
    notification memory not = notification(msg.sender, productId, "DONE");

    notifications[nrNotifications] = not;
    notificationWithState memory notWithState = notificationWithState(nrNotifications, notificationStatus.PENDING);
    managerNotifications[manager].push(notWithState);
    nrNotifications++;

    emit productDone(msg.sender, manager, productId);
  }

  function payFreelancers(uint notificationId) private {
    uint prod = notifications[notificationId].productId;
    address[] memory members = teams[prod];

    for (uint i = 0; i < members.length; i++) {
      freelenceProduct[] memory freeProd = productsFreelencers[members[i]];
      for(uint j = 0; j < freeProd.length; j++) {
        if (freeProd[j].productId == prod) {
          transferFrom(owner, members[i], freeProd[j].amount);
          users[members[i]].reputation++;
          break;
        }
      }
    }
  }

  function acceptDoneProduct(uint notificationId) public notificationExists(notificationId) validUser onlyManager{
    address manager = notifications[notificationId].senderFreelancer;

    notificationWithState[] memory not = managerNotifications[manager];
    for (uint i = 0; i < not.length; i++) {
      if (not[i].notificationId == notificationId) {
        payFreelancers(notificationId);
        not[i].status = notificationStatus.ACCEPTED;
        delete notifications[notificationId];
        break;
      }
    }
  }


}
