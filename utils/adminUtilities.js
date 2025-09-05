// utils/adminUtilities.js
const User = require('../models/user');
const { Provider, RateCard, Destination, Rate } = require('../models/provider');
const { Transaction } = require('../models/transaction');
const billingEngine = require('../services/billingEngine');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

class AdminUtilities {
  
  /**
   * Create a new user with rate card assignment
   */
  async createUser(userData) {
    const transaction = await sequelize.transaction();
    
    try {
      const {
        telegramId,
        username,
        firstName,
        lastName,
        email,
        rateCardId,
        creditLimit = 0,
        initialBalance = 0,
        timezone = 'UTC',
        currency = 'USD',
        createdBy
      } = userData;
      
      // Check if user already exists
      const existingUser = await User.findOne({ 
        where: { telegramId: telegramId.toString() } 
      });
      
      if (existingUser) {
        throw new Error('User with this Telegram ID already exists');
      }
      
      // Validate rate card if provided
      if (rateCardId) {
        const rateCard = await RateCard.findByPk(rateCardId);
        if (!rateCard || rateCard.status !== 'active') {
          throw new Error('Invalid or inactive rate card');
        }
      }
      
      // Create user
      const user = await User.create({
        telegramId: telegramId.toString(),
        username,
        firstName,
        lastName,
        email,
        rateCardId,
        creditLimit,
        balance: 0, // Always start with 0, add initial balance via transaction
        timezone,
        currency,
        status: 'active',
        userType: 'user',
        createdBy: createdBy.toString()
      }, { transaction });
      
      // Add initial balance if specified
      if (initialBalance > 0) {
        await user.update({ balance: initialBalance }, { transaction });
        
        await Transaction.create({
          userId: user.id,
          transactionType: 'credit',
          amount: initialBalance,
          balanceBefore: 0,
          balanceAfter: initialBalance,
          description: 'Initial account balance',
          createdBy: createdBy.toString()
        }, { transaction });
      }
      
      await transaction.commit();
      
      return {
        success: true,
        user: user.toJSON(),
        message: 'User created successfully'
      };
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  /**
   * Create a provider
   */
  async createProvider(providerData) {
    const {
      name,
      description,
      currency = 'USD',
      billingIncrement = 60,
      minimumDuration = 60
    } = providerData;
    
    const provider = await Provider.create({
      name,
      description,
      currency,
      billingIncrement,
      minimumDuration,
      status: 'active'
    });
    
    return {
      success: true,
      provider: provider.toJSON(),
      message: 'Provider created successfully'
    };
  }
  
  /**
   * Create a rate card
   */
  async createRateCard(rateCardData) {
    const {
      name,
      description,
      providerId,
      currency = 'USD',
      effectiveFrom = new Date()
    } = rateCardData;
    
    // Validate provider
    const provider = await Provider.findByPk(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }
    
    const rateCard = await RateCard.create({
      name,
      description,
      providerId,
      currency,
      effectiveFrom,
      status: 'active'
    });
    
    return {
      success: true,
      rateCard: rateCard.toJSON(),
      message: 'Rate card created successfully'
    };
  }
  
  /**
   * Bulk upload destinations from CSV
   */
  async bulkUploadDestinations(csvData) {
    const destinations = [];
    const lines = csvData.split('\n');
    
    for (let i = 1; i < lines.length; i++) { // Skip header
      const line = lines[i].trim();
      if (!line) continue;
      
      const [countryCode, countryName, prefix, description, region] = line.split(',');
      
      if (countryCode && countryName && prefix) {
        destinations.push({
          countryCode: countryCode.trim(),
          countryName: countryName.trim(),
          prefix: prefix.trim(),
          description: description ? description.trim() : null,
          region: region ? region.trim() : null,
          status: 'active'
        });
      }
    }
    
    if (destinations.length === 0) {
      throw new Error('No valid destinations found in CSV');
    }
    
    // Bulk create destinations
    const createdDestinations = await Destination.bulkCreate(destinations, {
      ignoreDuplicates: true,
      validate: true
    });
    
    return {
      success: true,
      created: createdDestinations.length,
      total: destinations.length,
      message: `${createdDestinations.length} destinations created successfully`
    };
  }
  
  /**
   * Bulk upload rates from CSV
   */
  async bulkUploadRates(rateCardId, csvData) {
    const transaction = await sequelize.transaction();
    
    try {
      // Validate rate card
      const rateCard = await RateCard.findByPk(rateCardId);
      if (!rateCard) {
        throw new Error('Rate card not found');
      }
      
      const rates = [];
      const lines = csvData.split('\n');
      
      for (let i = 1; i < lines.length; i++) { // Skip header
        const line = lines[i].trim();
        if (!line) continue;
        
        const [prefix, costPrice, sellPrice, minimumDuration, billingIncrement] = line.split(',');
        
        if (prefix && costPrice && sellPrice) {
          // Find destination by prefix
          const destination = await Destination.findOne({
            where: { prefix: prefix.trim() }
          });
          
          if (destination) {
            rates.push({
              rateCardId,
              destinationId: destination.id,
              costPrice: parseFloat(costPrice.trim()),
              sellPrice: parseFloat(sellPrice.trim()),
              minimumDuration: minimumDuration ? parseInt(minimumDuration.trim()) : 60,
              billingIncrement: billingIncrement ? parseInt(billingIncrement.trim()) : 60,
              effectiveFrom: new Date()
            });
          }
        }
      }
      
      if (rates.length === 0) {
        throw new Error('No valid rates found in CSV');
      }
      
      // Remove existing rates for this rate card
      await Rate.destroy({
        where: { rateCardId },
        transaction
      });
      
      // Bulk create new rates
      const createdRates = await Rate.bulkCreate(rates, {
        transaction,
        validate: true
      });
      
      // Clear billing engine caches
      billingEngine.clearCaches();
      
      await transaction.commit();
      
      return {
        success: true,
        created: createdRates.length,
        total: rates.length,
        message: `${createdRates.length} rates uploaded successfully`
      };
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  /**
   * Get system overview for admin dashboard
   */
  async getSystemOverview() {
    const [
      totalUsers,
      activeUsers,
      totalProviders,
      totalRateCards,
      totalDestinations,
      recentTransactions,
      topSpenders
    ] = await Promise.all([
      User.count(),
      User.count({ where: { status: 'active' } }),
      Provider.count({ where: { status: 'active' } }),
      RateCard.count({ where: { status: 'active' } }),
      Destination.count({ where: { status: 'active' } }),
      Transaction.findAll({
        include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'username'] }],
        order: [['createdAt', 'DESC']],
        limit: 10
      }),
      User.findAll({
        attributes: [
          'id', 'firstName', 'lastName', 'username', 'balance',
          [sequelize.fn('SUM', sequelize.col('transactions.amount')), 'totalSpent']
        ],
        include: [{
          model: Transaction,
          as: 'transactions',
          where: { transactionType: 'debit' },
          attributes: [],
          required: false
        }],
        group: ['User.id'],
        order: [[sequelize.fn('SUM', sequelize.col('transactions.amount')), 'DESC']],
        limit: 5
      })
    ]);
    
    return {
      overview: {
        totalUsers,
        activeUsers,
        totalProviders,
        totalRateCards,
        totalDestinations
      },
      recentTransactions,
      topSpenders
    };
  }
  
  /**
   * Get user details with financial summary
   */
  async getUserDetails(telegramId) {
    const user = await User.findOne({
      where: { telegramId: telegramId.toString() },
      include: [
        {
          model: RateCard,
          as: 'rateCard',
          include: [{ model: Provider, as: 'provider' }]
        }
      ]
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const financialSummary = await billingEngine.getUserFinancialSummary(user.id);
    
    return {
      user: user.toJSON(),
      financialSummary
    };
  }
  
  /**
   * Update user status
   */
  async updateUserStatus(telegramId, status, updatedBy) {
    const user = await User.findOne({
      where: { telegramId: telegramId.toString() }
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    await user.update({ status });
    
    return {
      success: true,
      message: `User status updated to ${status}`
    };
  }
  
  /**
   * Assign rate card to user
   */
  async assignRateCard(telegramId, rateCardId, assignedBy) {
    const transaction = await sequelize.transaction();
    
    try {
      const user = await User.findOne({
        where: { telegramId: telegramId.toString() }
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const rateCard = await RateCard.findByPk(rateCardId);
      if (!rateCard || rateCard.status !== 'active') {
        throw new Error('Invalid or inactive rate card');
      }
      
      await user.update({ rateCardId }, { transaction });
      
      // Clear billing caches to ensure new rates are used
      billingEngine.clearCaches();
      
      await transaction.commit();
      
      return {
        success: true,
        message: `Rate card "${rateCard.name}" assigned to user`
      };
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  
  /**
   * Generate financial report
   */
  async generateFinancialReport(startDate, endDate) {
    const whereClause = {};
    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [startDate, endDate]
      };
    }
    
    const [totalRevenue, totalCost, transactions, userStats] = await Promise.all([
      Transaction.sum('amount', {
        where: {
          ...whereClause,
          transactionType: 'debit'
        }
      }),
      // This would need to be calculated from call details if we track costs
      0, // Placeholder for total cost
      Transaction.findAll({
        where: whereClause,
        include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'username'] }],
        order: [['createdAt', 'DESC']]
      }),
      User.findAll({
        attributes: [
          'id', 'firstName', 'lastName', 'username',
          [sequelize.fn('SUM', sequelize.col('transactions.amount')), 'totalSpent'],
          [sequelize.fn('COUNT', sequelize.col('transactions.id')), 'transactionCount']
        ],
        include: [{
          model: Transaction,
          as: 'transactions',
          where: {
            ...whereClause,
            transactionType: 'debit'
          },
          attributes: [],
          required: true
        }],
        group: ['User.id'],
        order: [[sequelize.fn('SUM', sequelize.col('transactions.amount')), 'DESC']]
      })
    ]);
    
    return {
      summary: {
        totalRevenue: totalRevenue || 0,
        totalCost,
        profit: (totalRevenue || 0) - totalCost,
        transactionCount: transactions.length
      },
      transactions,
      userStats
    };
  }
}

module.exports = new AdminUtilities();