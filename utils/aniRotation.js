// utils/aniRotation.js
const Campaign = require('../models/campaign');

/**
 * Get the next caller ID for a campaign with ANI rotation
 * @param {Campaign} campaign - The campaign object
 * @returns {string} - The caller ID to use
 */
async function getNextCallerId(campaign) {
  // If rotation is not enabled, return the static caller ID
  if (!campaign.callerIdRotation || !campaign.callerIdPrefix) {
    return campaign.callerId;
  }
  
  // Increment rotation counter
  const rotationCounter = campaign.rotationCounter + 1;
  
  // Calculate the rotation index (0-99 for 100 numbers)
  const rotationIndex = rotationCounter % 100;
  
  // Generate the 4-digit suffix (0000-0099)
  const suffix = String(rotationIndex).padStart(4, '0');
  
  // Combine prefix with suffix
  const rotatedCallerId = campaign.callerIdPrefix + suffix;
  
  // Update the campaign's rotation counter
  await campaign.update({ rotationCounter });
  
  return rotatedCallerId;
}

/**
 * Parse caller ID input to extract prefix for rotation
 * @param {string} callerIdInput - The caller ID input from user
 * @returns {object} - Object with callerId, enableRotation, and prefix
 */
function parseCallerIdForRotation(callerIdInput) {
  // Remove all non-numeric characters
  const cleaned = callerIdInput.replace(/\D/g, '');
  
  // Check if input ends with XXXX (case insensitive)
  const rotationPattern = /XXXX$/i;
  const hasRotation = rotationPattern.test(callerIdInput.trim());
  
  if (hasRotation && cleaned.length >= 7) {
    // Extract the prefix (all digits except potential last 4)
    // For US numbers, we need at least area code + 3 digits before XXXX
    const prefix = cleaned.substring(0, cleaned.length - 4);
    
    return {
      callerId: cleaned, // Full number as fallback
      enableRotation: true,
      prefix: prefix
    };
  }
  
  return {
    callerId: cleaned,
    enableRotation: false,
    prefix: null
  };
}

module.exports = {
  getNextCallerId,
  parseCallerIdForRotation
};