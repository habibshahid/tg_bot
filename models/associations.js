// models/associations.js - ENHANCED VERSION with User-SipPeer associations
const User = require('./user');
const SipPeer = require('./sippeer');
const Campaign = require('./campaign');
const { Provider, RateCard, Destination, Rate } = require('./provider');
const { Transaction, CallDetail } = require('./transaction');

// User <-> RateCard associations
User.belongsTo(RateCard, {
  foreignKey: 'rateCardId',
  as: 'rateCard'
});

RateCard.hasMany(User, {
  foreignKey: 'rateCardId',
  as: 'users'
});

// NEW: User <-> SipPeer associations for approval workflow
User.belongsTo(SipPeer, {
  foreignKey: 'sipTrunkId',
  as: 'sipTrunk'
});

User.belongsTo(SipPeer, {
  foreignKey: 'callbackTrunkId',
  as: 'callbackTrunk'
});

// User <-> Transaction associations
User.hasMany(Transaction, {
  foreignKey: 'userId',
  as: 'transactions'
});

Transaction.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// User <-> CallDetail associations
User.hasMany(CallDetail, {
  foreignKey: 'userId',
  as: 'callDetails'
});

CallDetail.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Provider <-> RateCard associations
Provider.hasMany(RateCard, { 
  foreignKey: 'providerId',
  as: 'rateCards'
});

RateCard.belongsTo(Provider, { 
  foreignKey: 'providerId',
  as: 'provider'
});

// RateCard <-> Rate associations
RateCard.hasMany(Rate, {
  foreignKey: 'rateCardId',
  as: 'rates'
});

Rate.belongsTo(RateCard, {
  foreignKey: 'rateCardId',
  as: 'rateCard'
});

// Destination <-> Rate associations
Rate.belongsTo(Destination, {
  foreignKey: 'destinationId',
  as: 'destination'
});

Destination.hasMany(Rate, {
  foreignKey: 'destinationId',
  as: 'rates'
});

// CallDetail <-> RateCard associations
CallDetail.belongsTo(RateCard, {
  foreignKey: 'rateCardId',
  as: 'rateCard'
});

// CallDetail <-> Destination associations
CallDetail.belongsTo(Destination, {
  foreignKey: 'destinationId',
  as: 'destination'
});

// Transaction <-> CallDetail associations
Transaction.belongsTo(CallDetail, {
  foreignKey: 'callDetailId',
  as: 'callDetail'
});

CallDetail.hasOne(Transaction, {
  foreignKey: 'callDetailId',
  as: 'transaction'
});

// Campaign <-> SipPeer associations are already defined in campaign.js - DON'T DUPLICATE THEM HERE

console.log('✅ Model associations defined successfully');