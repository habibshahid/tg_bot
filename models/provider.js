// models/provider.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Provider = sequelize.define('Provider', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD'
  },
  billingIncrement: {
    type: DataTypes.INTEGER,
    defaultValue: 60,
    field: 'billing_increment',
    comment: 'Billing increment in seconds'
  },
  minimumDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 60,
    field: 'minimum_duration',
    comment: 'Minimum billing duration in seconds'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'providers',
  timestamps: true,
  underscored: true
});

// models/rateCard.js
const RateCard = sequelize.define('RateCard', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  providerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'provider_id'
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  effectiveFrom: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'effective_from',
    defaultValue: DataTypes.NOW
  },
  effectiveTo: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'effective_to'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'rate_cards',
  timestamps: true,
  underscored: true
});

// models/destination.js
const Destination = sequelize.define('Destination', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  countryCode: {
    type: DataTypes.STRING(10),
    allowNull: false,
    field: 'country_code'
  },
  countryName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'country_name'
  },
  prefix: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Dialing prefix (e.g., 1, 44, 92)'
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Additional description (e.g., Mobile, Fixed, Premium)'
  },
  region: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  }
}, {
  tableName: 'destinations',
  timestamps: true,
  updatedAt: false,
  underscored: true
});

// models/rate.js
const Rate = sequelize.define('Rate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  rateCardId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'rate_card_id'
  },
  destinationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'destination_id'
  },
  costPrice: {
    type: DataTypes.DECIMAL(10, 6),
    allowNull: false,
    field: 'cost_price',
    comment: 'Cost price per minute'
  },
  sellPrice: {
    type: DataTypes.DECIMAL(10, 6),
    allowNull: false,
    field: 'sell_price',
    comment: 'Selling price per minute'
  },
  minimumDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 60,
    field: 'minimum_duration',
    comment: 'Minimum billing duration in seconds'
  },
  billingIncrement: {
    type: DataTypes.INTEGER,
    defaultValue: 60,
    field: 'billing_increment',
    comment: 'Billing increment in seconds'
  },
  effectiveFrom: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'effective_from',
    defaultValue: DataTypes.NOW
  },
  effectiveTo: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'effective_to'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'rates',
  timestamps: true,
  underscored: true
});

module.exports = { Provider, RateCard, Destination, Rate };