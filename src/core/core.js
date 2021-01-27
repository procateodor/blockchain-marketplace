import {
  Button,
  Col,
  Divider,
  Input,
  message,
  Modal,
  Row,
  Space,
  Spin,
} from 'antd';
import { Fragment, useEffect, useState } from 'react';
import Web3 from 'web3';
import * as bigInt from 'big-integer';

import 'antd/dist/antd.css';
import './core.css';

import abi from './abi.json';

const ROLES = {
  0: 'Manager',
  1: 'Freelancer',
  2: 'Evaluator',
  3: 'Financer',
};

const STATES = {
  0: 'Backlog',
  1: 'In progress',
  2: 'Under review',
  3: 'Done',
};

const NOTIFICATIONS = {
  0: 'Pending',
  1: 'Accepted',
  2: 'Denied',
};

const MAX_GAS = 999999999;
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const NULL_NOTIFICATION = '99';

const CONTRACT_ADDRESS = '0x5350D42726401AE461aC9e6aCf2889FBfdB6B7CF';

export const Core = () => {
  const web3 = new Web3('http://localhost:8545');
  window.ethereum.enable();

  const marketplace = new web3.eth.Contract(abi, CONTRACT_ADDRESS);

  const [isUserLoading, setIsUserLoading] = useState(true);
  const [selectedAccountAddress, setSelectedAccountAddress] = useState(
    window.ethereum.selectedAddress,
  );
  const [userData, setUserData] = useState({});

  const [isAddProductModalVisible, setIsAddProductModalVisible] = useState(
    false,
  );
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [addProductData, setAddProductData] = useState({});

  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [products, setProducts] = useState([]);

  const [assigningProduct, setAssigningProduct] = useState(null);

  const [addingToTeamData, setAddingToTeamData] = useState({});

  const [
    isFinanceProductModalVisible,
    setIsFinanceProductModalVisible,
  ] = useState(false);
  const [isFinancingProduct, setIsFinancingProduct] = useState(false);
  const [financeProductData, setFinanceProductData] = useState({});

  const [isWithdrawModalVisible, setIsWithdrawModalVisible] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawData, setWithdrawData] = useState({});

  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinData, setJoinData] = useState({});

  const [sendingDone, setSendingDone] = useState(null);

  const [acceptManagerProduct, setAcceptManagerProduct] = useState(null);
  const [acceptEvaluatorProduct, setAcceptEvaluatorProduct] = useState(null);

  window.ethereum.on('accountsChanged', function (accounts) {
    setSelectedAccountAddress(accounts[0]);
  });

  const getProducts = async () => {
    try {
      setIsProductsLoading(true);
      const productIds = await marketplace.methods.getProducts().call({
        from: selectedAccountAddress,
      });

      const prods = [];

      for (const productId of productIds) {
        if (productId !== '99') {
          const response = await marketplace.methods
            .getProduct(productId)
            .call({
              from: selectedAccountAddress,
            });

          const productFreelancers = await marketplace.methods
            .getProductFreelancers(productId)
            .call({
              from: selectedAccountAddress,
            });

          let freelancers = [];
          let team = [];

          for (const productFreelancer of productFreelancers) {
            const freelancer = await marketplace.methods
              .getUserDetails(productFreelancer)
              .call({
                from: selectedAccountAddress,
              });

            const amount = await marketplace.methods
              .getFreelancerAmount(productId)
              .call({
                from: productFreelancer,
              });

            freelancers.push({
              name: freelancer[0],
              reputation: freelancer[1],
              domain: freelancer[2],
              address: productFreelancer,
              amount: parseInt(amount),
            });
          }

          const teamMembers = await marketplace.methods
            .getProductTeam(productId)
            .call({
              from: selectedAccountAddress,
            });

          for (const memberAddress of teamMembers) {
            const member = await marketplace.methods
              .getUserDetails(memberAddress)
              .call({
                from: selectedAccountAddress,
              });

            const amount = await marketplace.methods
              .getFreelancerAmount(productId)
              .call({
                from: memberAddress,
              });

            team.push({
              name: member[0],
              reputation: member[1],
              domain: member[2],
              address: memberAddress,
              amount: parseInt(amount),
            });
          }

          const funds = await marketplace.methods
            .getCurrentProductFunds(productId)
            .call({
              from: selectedAccountAddress,
            });

          const manager = await marketplace.methods
            .getUserDetails(response[4])
            .call({
              from: selectedAccountAddress,
            });

          const evaluator =
            response[5] !== NULL_ADDRESS
              ? (
                  await marketplace.methods.getUserDetails(response[5]).call({
                    from: selectedAccountAddress,
                  })
                )[0]
              : 'Unassigned';

          let spent = await marketplace.methods
            .getMyCurrentProductFunds(productId)
            .call({
              from: selectedAccountAddress,
            });

          const managerNotification = await marketplace.methods
            .getManagerNotifications(productId)
            .call({
              from: response[4],
            });

          let evaluatorNotification = [NULL_NOTIFICATION, '0'];

          if (response[5] !== NULL_ADDRESS) {
            evaluatorNotification = await marketplace.methods
              .getEvaluatorNotifications(productId)
              .call({
                from: response[5],
              });
          }

          prods.push({
            id: productId,
            description: response[0],
            dev: parseInt(response[1]),
            rev: parseInt(response[2]),
            domain: response[3],
            manager: manager[0],
            managerAddress: response[4],
            evaluator,
            evaluatorAddress: response[5],
            hasFunds: response[6],
            status: STATES[response[7]],
            funds: parseInt(funds),
            spent: parseInt(spent),
            isAssigned: productFreelancers
              .map(f => f.toLowerCase())
              .includes(selectedAccountAddress),
            freelancers,
            team,
            managerNotification: {
              id: managerNotification[0],
              status: NOTIFICATIONS[managerNotification[1]],
            },
            evaluatorNotification: {
              id: evaluatorNotification[0],
              status: NOTIFICATIONS[evaluatorNotification[1]],
            },
          });
        }
      }

      setProducts(prods);
      setIsProductsLoading(false);
      message.success('Products loaded!');
    } catch (e) {
      console.log(e);
    }
  };

  const getUser = async () => {
    try {
      setIsUserLoading(true);
      const response = await marketplace.methods.getUser().call({
        from: selectedAccountAddress,
      });

      const tokens = await marketplace.methods
        .balanceOf(selectedAccountAddress)
        .call({
          from: selectedAccountAddress,
        });

      setUserData({
        name: response[0],
        reputation: response[1],
        domain: response[2],
        role: ROLES[response[3]],
        address: selectedAccountAddress,
        tokens: bigInt(tokens),
      });
      setIsUserLoading(false);
      message.success('User loaded!');

      await getProducts();
    } catch (e) {
      console.log(e.message.split('revert ')[1]);
      message.error(e.message.split('revert ')[1]);
    }
  };

  const closeAddProductModal = () => {
    setAddProductData({});
    setIsAddProductModalVisible(false);
  };

  const closeFinanceProductModal = () => {
    setFinanceProductData({});
    setIsFinanceProductModalVisible(false);
  };

  const closeWithdrawModal = () => {
    setWithdrawData({});
    setIsWithdrawModalVisible(false);
  };

  const openFinanceProductModal = productId => {
    setFinanceProductData({
      productId,
    });
    setIsFinanceProductModalVisible(true);
  };

  const openWithdrawModal = productId => {
    setWithdrawData({
      productId,
    });
    setIsWithdrawModalVisible(true);
  };

  const openJoinModal = productId => {
    setJoinData({
      productId,
    });
    setIsJoinModalVisible(true);
  };

  const closeJoinModal = () => {
    setJoinData({});
    setIsJoinModalVisible(false);
  };

  const addProduct = async () => {
    try {
      setIsAddingProduct(true);

      await marketplace.methods
        .createProduct(
          addProductData.description,
          parseInt(addProductData.dev),
          parseInt(addProductData.rev),
          addProductData.domain,
        )
        .send({
          from: selectedAccountAddress,
          gas: MAX_GAS,
        });

      setIsAddingProduct(false);
      setIsAddProductModalVisible(false);
      setAddProductData({});
      message.success('Product added!');
      getProducts();
    } catch (e) {
      console.log(e);
    }
  };

  const financeProduct = async () => {
    try {
      setIsFinancingProduct(true);

      const product = products.find(
        prod => prod.id === financeProductData.productId,
      );

      if (
        product.funds + parseInt(financeProductData.value) >
        product.dev + product.rev
      ) {
        message.warning('Too many funds sent!');
        setIsFinancingProduct(false);
        return;
      }

      await marketplace.methods
        .financeProduct(financeProductData.productId, financeProductData.value)
        .send({
          from: selectedAccountAddress,
          gas: MAX_GAS,
        });

      setProducts(
        products.map(product =>
          product.id !== financeProductData.productId
            ? product
            : {
                ...product,
                hasFunds:
                  product.dev + product.rev <=
                  product.funds + parseInt(financeProductData.value),
                funds: product.funds + parseInt(financeProductData.value),
                spent: product.spent + parseInt(financeProductData.value),
              },
        ),
      );

      setUserData({
        ...userData,
        tokens: userData.tokens.minus(parseInt(financeProductData.value)),
      });

      setIsFinancingProduct(false);
      setIsFinanceProductModalVisible(false);
      setFinanceProductData({});
      message.success('Product financed!');
    } catch (e) {
      console.log(e);
    }
  };

  const withdrawFunds = async () => {
    try {
      setIsWithdrawing(true);

      const product = products.find(prod => prod.id === withdrawData.productId);

      if (product.spent - parseInt(withdrawData.value) < 0) {
        message.warning('Not enough funds!');
        setIsWithdrawing(false);
        return;
      }

      await marketplace.methods
        .withdrawFundsFromProduct(withdrawData.productId, withdrawData.value)
        .send({
          from: selectedAccountAddress,
          gas: MAX_GAS,
        });

      setProducts(
        products.map(product =>
          product.id !== withdrawData.productId
            ? product
            : {
                ...product,
                funds: product.funds - parseInt(withdrawData.value),
                spent: product.spent - parseInt(withdrawData.value),
              },
        ),
      );

      setUserData({
        ...userData,
        tokens: userData.tokens.add(parseInt(withdrawData.value)),
      });

      setIsWithdrawing(false);
      setIsWithdrawModalVisible(false);
      setWithdrawData({});
      message.success('Funds withdrawn!');
    } catch (e) {
      console.log(e);
    }
  };

  const deleteProduct = async productId => {
    try {
      setDeletingProduct(productId);

      await marketplace.methods.deleteProduct(productId).send({
        from: selectedAccountAddress,
        gas: MAX_GAS,
      });

      setProducts(products.filter(product => product.id !== productId));
      setDeletingProduct(null);
      message.success('Product deleted!');
    } catch (e) {
      console.log(e);
      message.error('Could not delete the product!');
      setDeletingProduct(null);
    }
  };

  const assignProduct = async productId => {
    try {
      setAssigningProduct(productId);

      await marketplace.methods.addEvaluator(productId).send({
        from: selectedAccountAddress,
        gas: MAX_GAS,
      });

      setProducts(
        products.map(product =>
          product.id !== productId
            ? product
            : {
                ...product,
                evaluator: userData.name,
              },
        ),
      );

      setAssigningProduct(null);
      message.success('Evaluator assigned to product!');
    } catch (e) {
      console.log(e);
    }
  };

  const joinProduct = async () => {
    try {
      setIsJoining(true);

      const product = products.find(prod => prod.id === joinData.productId);

      if (product.dev < parseInt(joinData.value)) {
        message.warning('Funds exceeded!');
        setIsJoining(false);
        return;
      }

      await marketplace.methods
        .addFreelencer(joinData.productId, joinData.value)
        .send({
          from: selectedAccountAddress,
          gas: MAX_GAS,
        });

      setProducts(
        products.map(product =>
          product.id !== joinData.productId
            ? product
            : {
                ...product,
                isAssigned: true,
              },
        ),
      );

      setIsJoining(false);
      setIsJoinModalVisible(false);
      setJoinData({});
      message.success('Joined the product!');
    } catch (e) {
      console.log(e);
    }
  };

  const addToTeam = async (productId, freelancer) => {
    try {
      setAddingToTeamData({
        productId,
        freelancer,
      });

      await marketplace.methods.addToTeam(productId, freelancer).send({
        from: selectedAccountAddress,
        gas: MAX_GAS,
      });

      setProducts(
        products.map(product =>
          product.id !== productId
            ? product
            : {
                ...product,
                team: [
                  ...product.team,
                  product.freelancers.find(fr => fr.address === freelancer),
                ],
                freelancers: product.freelancers.filter(
                  fr => fr.address !== freelancer,
                ),
                status:
                  [
                    ...product.team,
                    product.freelancers.find(fr => fr.address === freelancer),
                  ].reduce((sum, member) => sum + member.amount, 0) ===
                  product.dev
                    ? 'In progress'
                    : product.status,
              },
        ),
      );

      setAddingToTeamData({});
    } catch (e) {
      console.log(e);
    }
  };

  const sendingDoneStatus = async productId => {
    try {
      setSendingDone(productId);

      await marketplace.methods.notifyManagerDoneProduct(productId).send({
        from: selectedAccountAddress,
        gas: MAX_GAS,
      });

      setProducts(
        products.map(product =>
          product.id !== productId
            ? product
            : {
                ...product,
                status: STATES[2],
              },
        ),
      );

      setSendingDone(null);
    } catch (e) {
      console.log(e);
    }
  };

  const acceptProductManager = async (productId, notificationId) => {
    try {
      setAcceptManagerProduct(productId);

      await marketplace.methods.acceptDoneProduct(notificationId).send({
        from: selectedAccountAddress,
        gas: MAX_GAS,
      });

      setProducts(
        products.map(product =>
          product.id !== productId
            ? product
            : {
                ...product,
                status: STATES[3],
              },
        ),
      );

      const product = products.find(prod => prod.id === productId);

      setUserData({
        ...userData,
        tokens: userData.tokens.add(product.rev),
        reputation: parseInt(userData.reputation) + 1,
      });

      setAcceptManagerProduct(null);
    } catch (e) {
      console.log(e);
    }
  };

  const declineProductManager = async (
    productId,
    notificationId,
    evaluatorAddress,
  ) => {
    try {
      setAcceptManagerProduct(productId);

      await marketplace.methods
        .denyDoneProduct(notificationId, evaluatorAddress)
        .send({
          from: selectedAccountAddress,
          gas: MAX_GAS,
        });

      setProducts(
        products.map(product =>
          product.id !== productId
            ? product
            : {
                ...product,
                managerNotification: {
                  ...product.managerNotification,
                  status: NOTIFICATIONS[2],
                },
                evaluatorNotification: {
                  id: '0',
                  status: NOTIFICATIONS[0],
                },
              },
        ),
      );

      setAcceptManagerProduct(null);
    } catch (e) {
      console.log(e);
    }
  };

  const acceptProductEvaluator = async (productId, notificationId) => {
    try {
      setAcceptEvaluatorProduct(productId);

      await marketplace.methods.positiveEvalution(notificationId).send({
        from: selectedAccountAddress,
        gas: MAX_GAS,
      });

      setProducts(
        products.map(product =>
          product.id !== productId
            ? product
            : {
                ...product,
                status: STATES[3],
              },
        ),
      );

      const product = products.find(prod => prod.id === productId);

      setUserData({
        ...userData,
        tokens: userData.tokens.add(product.rev),
      });

      setAcceptEvaluatorProduct(null);
    } catch (e) {
      console.log(e);
    }
  };

  const declineProductEvaluator = async (productId, notificationId) => {
    try {
      setAcceptEvaluatorProduct(productId);

      await marketplace.methods.negativeEvalution(notificationId).send({
        from: selectedAccountAddress,
        gas: MAX_GAS,
      });

      setProducts(
        products.map(product =>
          product.id !== productId
            ? product
            : {
                ...product,
                status: STATES[0],
              },
        ),
      );

      const product = products.find(prod => prod.id === productId);

      setUserData({
        ...userData,
        tokens: userData.tokens.add(product.rev),
      });

      setAcceptEvaluatorProduct(null);
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    getUser();
  }, [selectedAccountAddress]);

  return isUserLoading ? (
    <Row justify="center" align="middle" className="main">
      <Spin />
    </Row>
  ) : (
    <Row justify="center" className="main">
      <Col lg={12} md={20} xs={24}>
        <Row align={'middle'} justify={'center'} className="navbar">
          <Space>
            <Col>
              <span>Name:</span> {userData.name}
            </Col>
            <Col>
              <span>Reputation:</span> {userData.reputation}
            </Col>
            {userData.domain && (
              <Col>
                <span>Domain:</span> {userData.domain}
              </Col>
            )}
            <Col>
              <span>Role:</span> {userData.role}
            </Col>
          </Space>
        </Row>
        <Row className="section-title" align="middle">
          <Col style={{ flex: 1 }} className="title">
            Products
          </Col>
          <Col>
            <Space>
              <span>{userData.tokens.toString()} Tokens</span>
              {userData.role === ROLES[0] && (
                <Button
                  loading={isAddProductModalVisible}
                  disabled={isAddProductModalVisible}
                  onClick={() => setIsAddProductModalVisible(true)}
                  type="primary"
                >
                  Add product
                </Button>
              )}
            </Space>
          </Col>
        </Row>
        {isProductsLoading ? (
          <Row className="loading" align="middle" justify="center">
            <Spin />
          </Row>
        ) : !products.length ? (
          <Row className="loading" align="middle" justify="center">
            <span>No products</span>
          </Row>
        ) : (
          <Row className="section" align="start" gutter={[10, 10]}>
            {products
              .filter(product =>
                userData.role === ROLES[1] || userData.role === ROLES[2]
                  ? product.hasFunds
                  : true,
              )
              .map(product => (
                <Col key={product.id} md={12} xm={12} xs={24}>
                  <div className="product-card">
                    <Row>
                      <Col xs={12}>
                        <span>Product Id:</span> {product.id}
                      </Col>
                      <Col xs={12}>
                        <span>Status:</span> {product.status}
                      </Col>
                      <Col xs={24}>
                        <span>Description:</span> {product.description}
                      </Col>
                      <Col xs={12}>
                        <span>Dev:</span> {product.dev}
                      </Col>
                      <Col xs={12}>
                        <span>Rev:</span> {product.rev}
                      </Col>
                      <Col xs={12}>
                        <span>Manager:</span> {product.manager}
                      </Col>
                      <Col xs={12}>
                        <span>Evaluator:</span> {product.evaluator}
                      </Col>
                      <Col xs={24}>
                        <span>Collected funds:</span> {product.funds}
                      </Col>
                      {userData.role === ROLES[0] && product.hasFunds && (
                        <Fragment>
                          <Divider></Divider>
                          <Row style={{ width: '100%' }}>
                            <Col xs={24}>
                              <span style={{ fontWeight: 'bold' }}>Team</span>
                            </Col>
                            {!product.team.length ? (
                              <Col xs={24}>No team members!</Col>
                            ) : (
                              product.team.map(member => (
                                <Col
                                  key={member.address}
                                  xs={24}
                                  className="card"
                                >
                                  <Row>
                                    <Col md={12} xs={24}>
                                      <span>Name:</span> {member.name}
                                    </Col>
                                    <Col md={12} xs={24}>
                                      <span>Reputation:</span>{' '}
                                      {member.reputation}
                                    </Col>
                                    <Col md={12} xs={24}>
                                      <span>Domain:</span> {member.domain}
                                    </Col>
                                    <Col md={12} xs={24}>
                                      <span>Amount:</span> {member.amount}
                                    </Col>
                                  </Row>
                                </Col>
                              ))
                            )}
                          </Row>
                          <Divider></Divider>
                          <Row style={{ width: '100%' }}>
                            <Col xs={24}>
                              <span style={{ fontWeight: 'bold' }}>
                                Freelancers
                              </span>
                            </Col>
                            {!product.freelancers.length ? (
                              <Col xs={24}>No freelancers joined!</Col>
                            ) : (
                              product.freelancers
                                .filter(
                                  freelancer =>
                                    !product.team.find(
                                      member =>
                                        member.address === freelancer.address,
                                    ),
                                )
                                .map(freelancer => (
                                  <Col
                                    key={freelancer.address}
                                    xs={24}
                                    className="card"
                                  >
                                    <Row>
                                      <Col md={12} xs={24}>
                                        <span>Name:</span> {freelancer.name}
                                      </Col>
                                      <Col md={12} xs={24}>
                                        <span>Reputation:</span>{' '}
                                        {freelancer.reputation}
                                      </Col>
                                      <Col md={12} xs={24}>
                                        <span>Domain:</span> {freelancer.domain}
                                      </Col>
                                      <Col md={12} xs={24}>
                                        <span>Amount:</span> {freelancer.amount}
                                      </Col>
                                    </Row>
                                    <Button
                                      loading={
                                        addingToTeamData.productId ===
                                          product.id &&
                                        addingToTeamData.freelancer ===
                                          freelancer.address
                                      }
                                      disabled={
                                        (addingToTeamData.productId ===
                                          product.id &&
                                          addingToTeamData.freelancer ===
                                            freelancer.address) ||
                                        product.team.reduce(
                                          (sum, member) => sum + member.amount,
                                          0,
                                        ) >= product.dev ||
                                        product.team.reduce(
                                          (sum, member) => sum + member.amount,
                                          0,
                                        ) +
                                          freelancer.amount >
                                          product.dev
                                      }
                                      onClick={() =>
                                        addToTeam(
                                          product.id,
                                          freelancer.address,
                                        )
                                      }
                                      block
                                      size="small"
                                      type="primary"
                                    >
                                      Add to team
                                    </Button>
                                  </Col>
                                ))
                            )}
                          </Row>
                        </Fragment>
                      )}
                      {userData.role === ROLES[3] && (
                        <Fragment>
                          <Col
                            xs={24}
                            style={{ marginTop: 10 }}
                            className="btn"
                          >
                            <Button
                              loading={
                                isFinancingProduct &&
                                financeProductData.productId === product.id
                              }
                              disabled={
                                (isFinancingProduct &&
                                  financeProductData.productId ===
                                    product.id) ||
                                product.hasFunds
                              }
                              onClick={() =>
                                openFinanceProductModal(product.id)
                              }
                              block
                              type="dashed"
                            >
                              Finance product (
                              {product.dev + product.rev - product.funds} left)
                            </Button>
                          </Col>
                          {product.spent > 0 && (
                            <Col xs={24} style={{ marginTop: 10 }}>
                              <Button
                                loading={
                                  isWithdrawing &&
                                  withdrawData.productId === product.id
                                }
                                disabled={
                                  (isWithdrawing &&
                                    withdrawData.productId === product.id) ||
                                  product.hasFunds
                                }
                                onClick={() => openWithdrawModal(product.id)}
                                block
                                type="dashed"
                              >
                                Withdraw funds ({product.spent} left)
                              </Button>
                            </Col>
                          )}
                        </Fragment>
                      )}
                      {userData.role === ROLES[0] &&
                        product.manager === userData.name && (
                          <Col xs={24} style={{ marginTop: 10 }}>
                            {product.managerNotification.id !==
                              NULL_NOTIFICATION &&
                              product.status === STATES[2] && (
                                <Fragment>
                                  {product.evaluatorNotification.id ===
                                    NULL_NOTIFICATION && (
                                    <Fragment>
                                      <Divider></Divider>
                                      <span style={{ marginBottom: 10 }}>
                                        Review product
                                      </span>
                                      <Row gutter={[10, 10]}>
                                        <Col xs={12}>
                                          <Button
                                            loading={
                                              acceptManagerProduct ===
                                              product.id
                                            }
                                            disabled={
                                              acceptManagerProduct ===
                                                product.id ||
                                              product.managerNotification
                                                .status === NOTIFICATIONS[2]
                                            }
                                            onClick={() =>
                                              acceptProductManager(
                                                product.id,
                                                product.managerNotification.id,
                                              )
                                            }
                                            block
                                            type="primary"
                                          >
                                            Accept
                                          </Button>
                                        </Col>
                                        <Col xs={12}>
                                          <Button
                                            loading={
                                              acceptManagerProduct ===
                                              product.id
                                            }
                                            disabled={
                                              acceptManagerProduct ===
                                                product.id ||
                                              product.managerNotification
                                                .status === NOTIFICATIONS[2]
                                            }
                                            onClick={() =>
                                              declineProductManager(
                                                product.id,
                                                product.managerNotification.id,
                                                product.evaluatorAddress,
                                              )
                                            }
                                            block
                                            type="danger"
                                          >
                                            Decline
                                          </Button>
                                        </Col>
                                      </Row>
                                    </Fragment>
                                  )}
                                  {product.evaluatorNotification.id !==
                                    NULL_NOTIFICATION && (
                                    <div>
                                      Waiting for {product.evaluator} review!
                                    </div>
                                  )}
                                </Fragment>
                              )}
                            <Button
                              loading={deletingProduct === product.id}
                              disabled={
                                deletingProduct === product.id ||
                                product.hasFunds
                              }
                              onClick={() => deleteProduct(product.id)}
                              block
                              type="danger"
                            >
                              Delete product
                            </Button>
                          </Col>
                        )}
                      {userData.role === ROLES[1] && (
                        <Col xs={24} style={{ marginTop: 10 }}>
                          <Button
                            loading={joinData.productId === product.id}
                            disabled={
                              joinData.productId === product.id ||
                              product.isAssigned ||
                              product.status !== STATES[0]
                            }
                            onClick={() => openJoinModal(product.id)}
                            block
                            type="dashed"
                          >
                            Join product
                          </Button>
                          {product.team.find(
                            member =>
                              member.address.toLowerCase() ===
                              userData.address.toLowerCase(),
                          ) &&
                            product.status !== STATES[0] && (
                              <Button
                                style={{ marginTop: 10 }}
                                loading={sendingDone === product.id}
                                disabled={
                                  sendingDone === product.id ||
                                  product.status === STATES[2] ||
                                  product.status === STATES[3]
                                }
                                onClick={() => sendingDoneStatus(product.id)}
                                block
                                type="primary"
                              >
                                Send done status
                              </Button>
                            )}
                        </Col>
                      )}
                      {userData.role === ROLES[2] && (
                        <Col xs={24} style={{ marginTop: 10 }}>
                          {product.evaluatorNotification.id !==
                            NULL_NOTIFICATION &&
                            product.status === STATES[2] && (
                              <Fragment>
                                <Divider></Divider>
                                <span style={{ marginBottom: 10 }}>
                                  Review product
                                </span>
                                <Row gutter={[10, 10]}>
                                  <Col xs={12}>
                                    <Button
                                      loading={
                                        acceptEvaluatorProduct === product.id
                                      }
                                      disabled={
                                        acceptEvaluatorProduct === product.id ||
                                        product.evaluatorNotification.status ===
                                          NOTIFICATIONS[2]
                                      }
                                      onClick={() =>
                                        acceptProductEvaluator(
                                          product.id,
                                          product.evaluatorNotification.id,
                                        )
                                      }
                                      block
                                      type="primary"
                                    >
                                      Accept
                                    </Button>
                                  </Col>
                                  <Col xs={12}>
                                    <Button
                                      loading={
                                        acceptEvaluatorProduct === product.id
                                      }
                                      disabled={
                                        acceptEvaluatorProduct === product.id ||
                                        product.evaluatorNotification.status ===
                                          NOTIFICATIONS[2]
                                      }
                                      onClick={() =>
                                        declineProductEvaluator(
                                          product.id,
                                          product.evaluatorNotification.id,
                                        )
                                      }
                                      block
                                      type="danger"
                                    >
                                      Decline
                                    </Button>
                                  </Col>
                                </Row>
                                {product.managerNotification.status ===
                                  NOTIFICATIONS[2] && (
                                  <div>
                                    Waiting for {product.evaluator} review!
                                  </div>
                                )}
                              </Fragment>
                            )}
                          <Button
                            loading={assigningProduct === product.id}
                            disabled={
                              assigningProduct === product.id ||
                              product.evaluator === userData.name ||
                              product.evaluator !== 'Unassigned'
                            }
                            onClick={() => assignProduct(product.id)}
                            block
                            type="dashed"
                          >
                            Assign to product
                          </Button>
                        </Col>
                      )}
                    </Row>
                  </div>
                </Col>
              ))}
          </Row>
        )}
      </Col>

      <Modal
        title="Add product"
        visible={isAddProductModalVisible}
        onOk={addProduct}
        confirmLoading={isAddingProduct}
        onCancel={closeAddProductModal}
      >
        <Input
          value={addProductData.description}
          placeholder="Enter description"
          allowClear
          onChange={e =>
            setAddProductData({
              ...addProductData,
              description: e.target.value,
            })
          }
        />
        <Input
          value={addProductData.dev}
          placeholder="Enter DEV"
          allowClear
          onChange={e =>
            setAddProductData({
              ...addProductData,
              dev: e.target.value,
            })
          }
        />
        <Input
          value={addProductData.rev}
          placeholder="Enter REV"
          allowClear
          onChange={e =>
            setAddProductData({
              ...addProductData,
              rev: e.target.value,
            })
          }
        />
        <Input
          value={addProductData.domain}
          placeholder="Enter domain"
          allowClear
          onChange={e =>
            setAddProductData({
              ...addProductData,
              domain: e.target.value,
            })
          }
        />
      </Modal>
      <Modal
        title="Finance product"
        visible={isFinanceProductModalVisible}
        onOk={financeProduct}
        confirmLoading={isFinancingProduct}
        onCancel={closeFinanceProductModal}
      >
        <Input
          value={financeProductData.value}
          placeholder="Enter value"
          allowClear
          onChange={e =>
            setFinanceProductData({
              ...financeProductData,
              value: e.target.value,
            })
          }
        />
      </Modal>
      <Modal
        title="Withdraw funds"
        visible={isWithdrawModalVisible}
        onOk={withdrawFunds}
        confirmLoading={isWithdrawing}
        onCancel={closeWithdrawModal}
      >
        <Input
          value={withdrawData.value}
          placeholder="Enter value"
          allowClear
          onChange={e =>
            setWithdrawData({
              ...withdrawData,
              value: e.target.value,
            })
          }
        />
      </Modal>
      <Modal
        title="Join product"
        visible={isJoinModalVisible}
        onOk={joinProduct}
        confirmLoading={isJoining}
        onCancel={closeJoinModal}
      >
        <Input
          value={joinData.value}
          placeholder="Enter value"
          allowClear
          onChange={e =>
            setJoinData({
              ...joinData,
              value: e.target.value,
            })
          }
        />
      </Modal>
    </Row>
  );
};
