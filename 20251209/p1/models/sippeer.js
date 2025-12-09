// =====================================
// SIPPEER MODEL (models/sippeer.js)
// =====================================
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SipPeer = sequelize.define('SipPeer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(128),
    allowNull: false,
    defaultValue: '',
    unique: true
  },
  context: {
    type: DataTypes.STRING(80),
    allowNull: false,
    defaultValue: ''
  },
  callingpres: {
    type: DataTypes.ENUM(
      'allowed_not_screened',
      'allowed_passed_screen',
      'allowed_failed_screen',
      'allowed',
      'prohib_not_screened',
      'prohib_passed_screen',
      'prohib_failed_screen',
      'prohib',
      'unavailable'
    ),
    defaultValue: 'allowed_not_screened'
  },
  deny: {
    type: DataTypes.STRING(95),
    defaultValue: '0.0.0.0/0.0.0.0'
  },
  permit: {
    type: DataTypes.STRING(95),
    defaultValue: '0.0.0.0/0.0.0.0'
  },
  mask: {
    type: DataTypes.STRING(95),
    allowNull: true
  },
  secret: {
    type: DataTypes.STRING(80),
    allowNull: false,
    defaultValue: ''
  },
  md5secret: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  remotesecret: {
    type: DataTypes.STRING(250),
    allowNull: true
  },
  transport: {
    type: DataTypes.STRING(50),
    defaultValue: 'udp,ws'
  },
  host: {
    type: DataTypes.STRING(31),
    allowNull: false,
    defaultValue: 'dynamic'
  },
  nat: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'force_rport,comedia'
  },
  type: {
    type: DataTypes.ENUM('user', 'peer', 'friend'),
    allowNull: false,
    defaultValue: 'friend'
  },
  accountcode: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  amaflags: {
    type: DataTypes.STRING(13),
    defaultValue: 'default'
  },
  callgroup: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  callerid: {
    type: DataTypes.STRING(80),
    defaultValue: '"" <>'
  },
  cancallforward: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'yes'
  },
  canreinvite: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'no'
  },
  defaultip: {
    type: DataTypes.STRING(15),
    allowNull: true
  },
  dtmfmode: {
    type: DataTypes.STRING(7),
    defaultValue: 'rfc2833'
  },
  musiconhold: {
    type: DataTypes.STRING(128),
    defaultValue: 'intellicon'
  },
  fromuser: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  fromdomain: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  insecure: {
    type: DataTypes.STRING(32),
    allowNull: true
  },
  language: {
    type: DataTypes.CHAR(2),
    defaultValue: 'en'
  },
  mailbox: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  pickupgroup: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  qualify: {
    type: DataTypes.CHAR(3),
    defaultValue: 'yes'
  },
  restrictcid: {
    type: DataTypes.CHAR(3),
    allowNull: true
  },
  regexten: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  rtptimeout: {
    type: DataTypes.CHAR(3),
    defaultValue: '60'
  },
  rtpholdtimeout: {
    type: DataTypes.CHAR(3),
    defaultValue: '300'
  },
  setvar: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  disallow: {
    type: DataTypes.STRING(100),
    defaultValue: 'all'
  },
  allow: {
    type: DataTypes.STRING(100),
    defaultValue: 'alaw;ulaw;gsm'
  },
  fullcontact: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: ''
  },
  ipaddr: {
    type: DataTypes.STRING(45),
    allowNull: false,
    defaultValue: ''
  },
  port: {
    type: DataTypes.STRING(5),
    defaultValue: ''
  },
  username: {
    type: DataTypes.STRING(80),
    allowNull: false,
    defaultValue: ''
  },
  defaultuser: {
    type: DataTypes.STRING(80),
    allowNull: false,
    defaultValue: ''
  },
  subscribecontext: {
    type: DataTypes.STRING(80),
    defaultValue: 'BUSY-LAMP-FIELD'
  },
  directmedia: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'no'
  },
  trustrpid: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'no'
  },
  sendrpid: {
    type: DataTypes.ENUM('yes', 'no', 'pai'),
    defaultValue: 'no'
  },
  progressinband: {
    type: DataTypes.ENUM('never', 'yes', 'no'),
    allowNull: true
  },
  promiscredir: {
    type: DataTypes.ENUM('yes', 'no'),
    allowNull: true
  },
  useclientcode: {
    type: DataTypes.ENUM('yes', 'no'),
    allowNull: true
  },
  callcounter: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'yes'
  },
  busylevel: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 1
  },
  allowoverlap: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'yes'
  },
  allowsubscribe: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'yes'
  },
  allowtransfer: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'yes'
  },
  ignoresdpversion: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'no'
  },
  videosupport: {
    type: DataTypes.ENUM('yes', 'no', 'always'),
    defaultValue: 'no'
  },
  maxcallbitrate: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true
  },
  rfc2833compensate: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'yes'
  },
  session_timers: {
    type: DataTypes.ENUM('originate', 'accept', 'refuse'),
    defaultValue: 'accept'
  },
  session_expires: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 1800
  },
  session_minse: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 90
  },
  session_refresher: {
    type: DataTypes.ENUM('uac', 'uas'),
    defaultValue: 'uas'
  },
  'call-limit': {
    type: DataTypes.INTEGER,
    defaultValue: 2,
    field: 'call-limit'
  },
  t38pt_usertpsource: {
    type: DataTypes.ENUM('yes', 'no'),
    allowNull: true
  },
  outboundproxy: {
    type: DataTypes.STRING(250),
    allowNull: true
  },
  usereqphone: {
    type: DataTypes.STRING(16),
    defaultValue: 'no'
  },
  callbackextension: {
    type: DataTypes.STRING(250),
    allowNull: true
  },
  registertrying: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'yes'
  },
  timert1: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 500
  },
  timerb: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true
  },
  qualifyfreq: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 60
  },
  contactpermit: {
    type: DataTypes.STRING(250),
    allowNull: true
  },
  contactdeny: {
    type: DataTypes.STRING(250),
    allowNull: true
  },
  lastms: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  regserver: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  regseconds: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  useragent: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  limitonpeers: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'yes'
  },
  icesupport: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'no'
  },
  hasiax: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'no'
  },
  hassip: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'no'
  },
  encryption: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'no'
  },
  avpf: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'no'
  },
  force_avp: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'no'
  },
  dtlsenable: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'no'
  },
  dtlsverify: {
    type: DataTypes.ENUM('yes', 'no'),
    defaultValue: 'no'
  },
  dtlssetup: {
    type: DataTypes.STRING(32),
    defaultValue: 'actpass'
  },
  dtlscertfile: {
    type: DataTypes.STRING(128),
    defaultValue: '/etc/ssl/certs/ssl-cert-snakeoil.pem'
  },
  dtlsprivatekey: {
    type: DataTypes.STRING(128),
    defaultValue: '/etc/ssl/private/ssl-cert-snakeoil.key'
  },
  rtcp_mux: {
    type: DataTypes.STRING(3),
    defaultValue: 'no'
  },
  category: {
    type: DataTypes.ENUM('sip', 'webrtc', 'trunk', 'webrtc_gw'),
    allowNull: false,
    defaultValue: 'sip'
  },
  register_string: {
    type: DataTypes.STRING(256),
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: true
  },
  description: {
    type: DataTypes.STRING(256),
    allowNull: true
  },
  status: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  first_name: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  last_name: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  extension_no: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  auto_answer: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  sippasswd: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  externalCallerId: {
    type: DataTypes.STRING(32),
    defaultValue: ''
  }
}, {
  tableName: 'sippeers',
  timestamps: false, // Since we're using created_at manually
  underscored: false // Since the table uses mixed naming conventions
});


module.exports = SipPeer;