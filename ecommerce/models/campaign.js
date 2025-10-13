// =====================================
// CAMPAIGN MODEL (models/campaign.js)
// =====================================
const {
    DataTypes
} = require('sequelize');
const sequelize = require('../config/database');
const SipPeer = require('./sippeer');

const Campaign = sequelize.define('Campaign', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    botToken: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        field: 'bot_token'
    },
    campaignName: {
        type: DataTypes.STRING(100),
        defaultValue: 'Default Campaign',
        field: 'campaign_name'
    },
    sipTrunkId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'sip_trunk_id'
    },
    callbackTrunkId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'callback_trunk_id',
        references: {
            model: 'sippeers',
            key: 'id'
        }
    },
    callbackTrunkNumber: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'callback_trunk_number'
    },
    concurrentCalls: {
        type: DataTypes.INTEGER,
        defaultValue: 30,
        field: 'concurrent_calls'
    },
    callerId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'caller_id'
    },
    callerIdRotation: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'caller_id_rotation'
    },
    callerIdPrefix: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'caller_id_prefix',
        comment: 'First digits of caller ID for rotation (e.g., 1234567 for 1234567XXXX)'
    },
    transferNumber: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'transfer_number',
        comment: 'Phone number to transfer calls to'
    },
    transferEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'transfer_enabled'
    },

    moh_audio_file: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
        field: 'moh_audio_file'
    },

    // Press 0 Features
    press0_transfer_enabled: {
        type: DataTypes.TINYINT(1),
        allowNull: true,
        defaultValue: 0,
        field: 'press0_transfer_enabled'
    },
    press0_transfer_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
        field: 'press0_transfer_number'
    },
    press0_audio_file: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
        field: 'press0_audio_file'
    },

    // Press 1 Custom Audio
    press1_audio_file: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
        field: 'press1_audio_file'
    },

    // OTP Verified Audio
    verified_otp_audio_file: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
        field: 'verified_otp_audio_file'
    },

    // OTP Attempt Counter
    otp_attempt_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        field: 'otp_attempt_count'
    },
    press2_audio_file: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'press2_audio_file',
        comment: 'Custom audio file for press 2 scenario'
    },
    press2_transfer_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'press2_transfer_number'
    },
    press2_transfer_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'press2_transfer_enabled'
    },
    press1TransferNumber: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'press2_transfer_number'
    },
    press1TransferEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'press2_transfer_enabled'
    },
    invalidOtpAudioFile: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'invalid_otp_audio_file',
        comment: 'Custom audio file for invalid OTP scenario'
    },
    invalidOtpTransferNumber: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'invalid_otp_transfer_number'
    },
    invalidOtpTransferEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'invalid_otp_transfer_enabled'
    },
    dialPrefix: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'dial_prefix',
        defaultValue: ''
    },
    notificationsChatId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'notifications_chat_id'
    },
    ivrIntroFile: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'ivr_intro_file'
    },
    ivrOutroFile: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'ivr_outro_file'
    },
    dtmfDigit: {
        type: DataTypes.STRING(1),
        defaultValue: '1',
        field: 'dtmf_digit'
    },
    totalCalls: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'total_calls'
    },
    successfulCalls: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'successful_calls'
    },
    failedCalls: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'failed_calls'
    },
    voicemailCalls: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'voicemail_calls'
    },
    dtmfResponses: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'dtmf_responses'
    },
    callCounter: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'call_counter'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active'
    },
    campaignStatus: {
        type: DataTypes.ENUM('immediate', 'scheduled', 'running', 'paused', 'completed', 'cancelled'),
        defaultValue: 'immediate',
        field: 'campaign_status'
    },
    scheduledStart: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'scheduled_start'
    },
    scheduledEnd: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'scheduled_end'
    },
    timezone: {
        type: DataTypes.STRING(50),
        defaultValue: 'UTC',
        field: 'timezone'
    },
    numbersList: {
        type: DataTypes.TEXT('long'),
        field: 'numbers_list',
        get() {
            const rawValue = this.getDataValue('numbersList');
            return rawValue ? JSON.parse(rawValue) : [];
        },
        set(value) {
            this.setDataValue('numbersList', JSON.stringify(value));
        }
    },
    createdBy: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'created_by'
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
    tableName: 'campaigns',
    timestamps: true,
    underscored: true
});

Campaign.belongsTo(SipPeer, {
    as: 'sipTrunk',
    foreignKey: 'sipTrunkId'
});

// ADD THIS NEW ASSOCIATION:
Campaign.belongsTo(SipPeer, {
    as: 'callbackTrunk',
    foreignKey: 'callbackTrunkId'
});

module.exports = Campaign;