// API functions for sending messages

// Mock API functions for email - replace with real service integrations
export const sendEmail = async (emailData: {
  to: string[];
  subject: string;
  text: string;
  html: string;
}) => {
  console.log('Sending email:', emailData);
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log(`Email sent to: ${emailData.to.join(', ')}`);
  return { success: true, messageId: Date.now().toString() };
};

// Mock SMS implementation with confirmation link generation
export const sendSMS = async (phoneNumber: string, message: string) => {
  console.log(`\n=== SENDING SMS ===`);
  console.log(`From: 3172506454`);
  console.log(`To: ${phoneNumber}`);
  console.log(`Message: ${message}`);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('✅ SMS sent successfully (mock)!');
  return { 
    success: true, 
    messageId: `sms-${Date.now()}`,
    status: 'delivered',
    from: '3172506454',
    to: phoneNumber,
    note: 'Mock SMS - configure real SMS service for production'
  };
};

// Send confirmation SMS to losing team
export const sendConfirmationSMS = async (phoneNumber: string, gameData: {
  loserTeam: string;
  winnerTeam: string;
  round: number;
  nextTable: number;
  nextOpponent: string;
}) => {
  const confirmationUrl = `${window.location.origin}?confirm=${gameData.loserTeam}&round=${gameData.round}`;
  const message = `Tough loss, please confirm the final results and then proceed to table ${gameData.nextTable} to play ${gameData.nextOpponent} in round ${gameData.round + 1}. Confirm here: ${confirmationUrl}`;
  
  return await sendSMS(phoneNumber, message);
};

// Batch SMS function
export const sendSMSBatch = async (smsData: {
  to: string[];
  body: string;
}) => {
  const results = [];
  
  for (const phoneNumber of smsData.to) {
    const result = await sendSMS(phoneNumber, smsData.body);
    results.push({ ...result, to: phoneNumber });
  }
  
  return results;
};