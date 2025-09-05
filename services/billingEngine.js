// services/billingEngine.js
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const User = require('../models/user');
const { Rate, Destination } = require('../models/provider');
const { Transaction, CallDetail } = require('../models/transaction');

class BillingEngine {
  constructor() {
    this.prefixCache = new Map();
    this.rateCache = new Map();
  }

  /**
   * Find destination based on phone number
   */
  async findDestination(phoneNumber) {
    // Remove + and any non-numeric characters
    const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
    
    // Check cache first
    if (this.prefixCache.has(cleanNumber)) {
      return this.prefixCache.get(cleanNumber);
    }

    // Find longest matching prefix
    let destination = null;
    let maxPrefixLength = 0;

    const destinations = await Destination.findAll({
      where: { status: 'active' },
      order: [['prefix', 'DESC']]
    });

    for (const dest of destinations) {
      if (cleanNumber.startsWith(dest.prefix) && dest.prefix.length > maxPrefixLength) {
        destination = dest;
        maxPrefixLength = dest.prefix.length;
      }
    }

    // Cache the result
    if (destination) {
      this.prefixCache.set(cleanNumber, destination);
    }

    return destination;
  }

  /**
   * Get rate for a destination and rate card
   */
  async getRate(rateCardId, destinationId) {
    const cacheKey = `${rateCardId}_${destinationId}`;
    
    if (this.rateCache.has(cacheKey)) {
      return this.rateCache.get(cacheKey);
    }

    const rate = await Rate.findOne({
      where: {
        rateCardId,
        destinationId,
        effectiveFrom: { [Op.lte]: new Date() },
        [Op.or]: [
          { effectiveTo: null },
          { effectiveTo: { [Op.gte]: new Date() } }
        ]
      },
      order: [['effectiveFrom', 'DESC']]
    });

    if (rate) {
      this.rateCache.set(cacheKey, rate);
    }

    return rate;
  }

  /**
   * Calculate billable duration based on minimum duration and billing increment
   */
  calculateBillableDuration(actualDuration, minimumDuration = 60, billingIncrement = 60) {
    if (actualDuration < minimumDuration) {
      return minimumDuration;
    }

    // Round up to next billing increment
    return Math.ceil(actualDuration / billingIncrement) * billingIncrement;
  }

  /**
   * Calculate call charges
   */
  calculateCallCharges(rate, billableDurationSeconds) {
    const billableDurationMinutes = billableDurationSeconds / 60;
    
    const totalCost = parseFloat(rate.costPrice) * billableDurationMinutes;
    const totalCharge = parseFloat(rate.sellPrice) * billableDurationMinutes;
    const profit = totalCharge - totalCost;

    return {
      totalCost: parseFloat(totalCost.toFixed(4)),
      totalCharge: parseFloat(totalCharge.toFixed(4)),
      profit: parseFloat(profit.toFixed(4))
    };
  }

  /**
   * Check if user has sufficient balance
   */
  async checkSufficientBalance(userId, estimatedCost) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const availableBalance = parseFloat(user.balance) + parseFloat(user.creditLimit);
    return {
      hasSufficientBalance: availableBalance >= estimatedCost,
      currentBalance: parseFloat(user.balance),
      creditLimit: parseFloat(user.creditLimit),
      availableBalance,
      estimatedCost
    };
  }

  /**
   * Estimate call cost for pre-call validation
   */
  async estimateCallCost(userId, phoneNumber, estimatedDurationMinutes = 5) {
	  try {
		const user = await User.findByPk(userId);
		if (!user) {
		  throw new Error('USER_NOT_FOUND');
		}
		
		if (!user.rateCardId) {
		  throw new Error('NO_RATE_CARD_ASSIGNED');
		}
		
		if (user.status !== 'active') {
		  throw new Error('USER_ACCOUNT_SUSPENDED');
		}

		const destination = await this.findDestination(phoneNumber);
		if (!destination) {
		  throw new Error('DESTINATION_NOT_SUPPORTED');
		}

		const rate = await this.getRate(user.rateCardId, destination.id);
		if (!rate) {
		  throw new Error('NO_RATE_AVAILABLE');
		}

		const estimatedCost = parseFloat(rate.sellPrice) * estimatedDurationMinutes;
		
		return {
		  success: true,
		  destination,
		  rate,
		  estimatedCost,
		  sellPrice: parseFloat(rate.sellPrice),
		  currency: user.currency || 'USD'
		};
		
	  } catch (error) {
		return {
		  success: false,
		  error: error.message,
		  userFriendlyMessage: this.getUserFriendlyErrorMessage(error.message)
		};
	  }
	}

	/**
	 * Get user-friendly error messages
	 */
	getUserFriendlyErrorMessage(errorCode) {
	  const messages = {
		'USER_NOT_FOUND': 'User account not found. Please contact administrator.',
		'NO_RATE_CARD_ASSIGNED': 'No rate card assigned to your account. Please contact administrator.',
		'USER_ACCOUNT_SUSPENDED': 'Your account is suspended. Please contact administrator.',
		'DESTINATION_NOT_SUPPORTED': 'This destination is not supported in your rate card.',
		'NO_RATE_AVAILABLE': 'No rates available for this destination.',
		'INSUFFICIENT_BALANCE': 'Insufficient balance. Please add credit to your account.'
	  };
	  
	  return messages[errorCode] || 'An error occurred while processing your request.';
	}

  /**
   * Process call billing after call completion
   */
  async processCallBilling(callDetailData) {
    const transaction = await sequelize.transaction();
    
    try {
      const {
        userId,
        phoneNumber,
        callDuration,
        callStatus,
        campaignId,
        callId,
        callStarted,
        callAnswered,
        callEnded,
        hangupCause,
        dtmfPressed,
        sipTrunkId,
        callerId
      } = callDetailData;

      // Get user and rate card
      const user = await User.findByPk(userId);
      if (!user || !user.rateCardId) {
        throw new Error('User not found or no rate card assigned');
      }

      // Find destination
      const destination = await this.findDestination(phoneNumber);
      if (!destination) {
        // Create call detail without billing for unknown destinations
        await CallDetail.create({
          userId,
          campaignId,
          callId,
          phoneNumber,
          callStarted,
          callAnswered,
          callEnded,
          callDuration: callDuration || 0,
          billableDuration: 0,
          callStatus: callStatus || 'failed',
          hangupCause: hangupCause || 'DESTINATION_NOT_FOUND',
          dtmfPressed,
          sipTrunkId,
          callerId,
          totalCost: 0,
          totalCharge: 0,
          profit: 0,
          processed: true
        }, { transaction });

        await transaction.commit();
        return { success: false, reason: 'Destination not found' };
      }

      // Get rate
      const rate = await this.getRate(user.rateCardId, destination.id);
      if (!rate) {
        throw new Error('No rate found for this destination');
      }

      // Calculate billing only for answered calls
      let billableDuration = 0;
      let charges = { totalCost: 0, totalCharge: 0, profit: 0 };

      if (callStatus === 'answered' && callDuration > 0) {
        billableDuration = this.calculateBillableDuration(
          callDuration,
          rate.minimumDuration,
          rate.billingIncrement
        );
        charges = this.calculateCallCharges(rate, billableDuration);
      }

      // Create call detail record
      const callDetail = await CallDetail.create({
        userId,
        campaignId,
        callId,
        phoneNumber,
        destinationId: destination.id,
        rateCardId: user.rateCardId,
        callStarted,
        callAnswered,
        callEnded,
        callDuration: callDuration || 0,
        billableDuration,
        callStatus: callStatus || 'failed',
        hangupCause,
        dtmfPressed,
        costPrice: parseFloat(rate.costPrice),
        sellPrice: parseFloat(rate.sellPrice),
        totalCost: charges.totalCost,
        totalCharge: charges.totalCharge,
        profit: charges.profit,
        sipTrunkId,
        callerId,
        processed: false
      }, { transaction });

      // Process billing if there's a charge
      if (charges.totalCharge > 0) {
        const balanceBefore = parseFloat(user.balance);
        const newBalance = balanceBefore - charges.totalCharge;

        // Update user balance
        await user.update({ balance: newBalance }, { transaction });

        // Create transaction record
        await Transaction.create({
          userId,
          transactionType: 'debit',
          amount: charges.totalCharge,
          balanceBefore,
          balanceAfter: newBalance,
          description: `Call to ${phoneNumber} - ${Math.round(billableDuration/60)}min`,
          reference: callId,
          callDetailId: callDetail.id,
          createdBy: 'system'
        }, { transaction });

        // Mark call as processed
        await callDetail.update({ processed: true }, { transaction });
      } else {
        // Mark as processed even if no charge (failed calls, etc.)
        await callDetail.update({ processed: true }, { transaction });
      }

      await transaction.commit();

      return {
        success: true,
        callDetail: callDetail.toJSON(),
        charges,
        newBalance: parseFloat(user.balance)
      };

    } catch (error) {
      await transaction.rollback();
      console.error('Billing processing error:', error);
      throw error;
    }
  }

  /**
   * Add credit to user account
   */
  async addCredit(userId, amount, description, createdBy) {
    const transaction = await sequelize.transaction();
    
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const balanceBefore = parseFloat(user.balance);
      const newBalance = balanceBefore + parseFloat(amount);

      await user.update({ balance: newBalance }, { transaction });

      await Transaction.create({
        userId,
        transactionType: 'credit',
        amount: parseFloat(amount),
        balanceBefore,
        balanceAfter: newBalance,
        description: description || 'Credit added by admin',
        createdBy
      }, { transaction });

      await transaction.commit();

      return {
        success: true,
        newBalance,
        transaction: { amount: parseFloat(amount), description }
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get user financial summary
   */
  async getUserFinancialSummary(userId, startDate = null, endDate = null) {
    const whereClause = { userId };
    
    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.createdAt = {
        [Op.gte]: startDate
      };
    }

    const [user, transactions, callDetails] = await Promise.all([
      User.findByPk(userId),
      Transaction.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: 100
      }),
      CallDetail.findAll({
        where: whereClause,
        include: [
          { model: Destination, as: 'destination' }
        ],
        order: [['createdAt', 'DESC']],
        limit: 100
      })
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate summary stats
    const summary = {
      currentBalance: parseFloat(user.balance),
      creditLimit: parseFloat(user.creditLimit),
      availableBalance: parseFloat(user.balance) + parseFloat(user.creditLimit),
      totalCalls: callDetails.length,
      answeredCalls: callDetails.filter(cd => cd.callStatus === 'answered').length,
      totalSpent: callDetails.reduce((sum, cd) => sum + parseFloat(cd.totalCharge), 0),
      totalMinutes: callDetails.reduce((sum, cd) => sum + (cd.billableDuration / 60), 0)
    };

    return {
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        rateCardId: user.rateCardId
      },
      summary,
      recentTransactions: transactions,
      recentCalls: callDetails
    };
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this.prefixCache.clear();
    this.rateCache.clear();
  }
}

module.exports = new BillingEngine();