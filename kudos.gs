// All your config goes here
var ID = "THEIDOFTHESPREADSHEET"; //The id of the Google SpreadSheet
var DATA_SHEET_NAME = "SHEETTODUMPDATA"; //The Sheet which will get populated with all the call details
var AGENT_SHEET_NAME = "AGENTSMAPPINGSHEET"; //The Sheet which has the phone number to Agent Name, Id mapping
var KUDOSGROUP = 'GROUPIDOFKUDOS'; //The ID of the public group to send Kudos for great ratings
var FOLLOWUPGROUP = 'GROUPIDOFNOTSOGOODONES';//The ID of the private group to send info on ratings that are not great so you can followup
//Pick these from Google Service Account Credentials json 
var SERVICE_ACCOUNT_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nSOMEGIBBERISHFROMTHEJSONSFILE\n-----END PRIVATE KEY-----\n';
var SERVICE_ACCOUNT_EMAIL = 'emailof@yourserviceaccount';

/*
* The Endpoint that handles the passthru applet
*/
function doGet(e) {
  var params = JSON.stringify(e.parameters);
  var jsonMapping = JSON.parse(params);
  var sheet = SpreadsheetApp.openById(ID).getSheetByName(DATA_SHEET_NAME);
  // Just append call details to the spreadsheet
  sheet.appendRow([jsonMapping["CallSid"][0], jsonMapping["From"][0], jsonMapping["To"][0], jsonMapping["StartTime"][0], jsonMapping["CurrentTime"][0], jsonMapping["DialWhomNumber"][0], jsonMapping["digits"][0]]);
  postKudos(e);
  return ContentService.createTextOutput(JSON.stringify(e.parameters));
}

/*
* The Post Kudos Handler
*/
function postKudos(e) {
  var agent = e.parameter.DialWhomNumber;
  var digits = e.parameter.digits;
  var agentName = getAgentName(agent);
  if (!agentName) {
    agentName = agent;
  }
  var response = getMessageAndGaroupToSend(digits, agentName);
  if (response) {
    postMessage(response[1], response[0]);
  }
}

/*
* This code returns the message and the group the message needs to be posted to
* You can modify this with your messages depending on your rating scale
*/
function getMessageAndGroupToSend(digits, agent) {
  var adj;
  var group;
  switch (digits) {
    case '"5"':
      adj = "A customer was extremely satisfied with " + agent + "'s support . Fantastic Work 🎉🥳";
      group = KUDOSGROUP;
      break;
    case '"4"':
      adj = "A customer was very satisfied with " + agent + "'s support . Fantastic Work 🎉🥳";
      group = KUDOSGROUP;
      break;
    default:
      adj = "A customer attended to by " + agent + " rated " + digits + " . Check if they need some help";
      group = FOLLOWUPGROUP;
      break;
  }
  return [adj, group]
}

/*
 * Looks up a sheet for a phone number. The sheet entry is of the following format
 * phonenumber,name,userid
 * Userid is the userid of the agent on google chat
 * It returns the userid if that is populated if not the agent name 
 * The users/userid is needed to support direct 
 * mentions. But getting userid is not straightforward - https://stackoverflow.com/questions/49439731/how-can-a-webhook-identify-user-ids
 */
function getAgentName(phNo) {
  var sh = SpreadsheetApp.openById(ID).getSheetByName(AGENT_SHEET_NAME);
  var values = sh.getDataRange().getValues();

  for (var i = 0, iLen = values.length; i < iLen; i++) {
    if (values[i][0] == phNo) {
      if (values[i][2]) {
        return "<users/" + values[i][2] + ">";
      }
      return (values[i][1]);
    }
  }
  return null;
}



/*
* Posts a message into the given space ID via the API, using
* service account authentication.
*/
function postMessage(spaceId, message) {
  var chatmessage = { 'text': message };
  var SCOPE = 'https://www.googleapis.com/auth/chat.bot';
  // The values below are from GSA json file
  var service = OAuth2.createService('chat')
    .setTokenUrl('https://accounts.google.com/o/oauth2/token')
    .setPrivateKey(SERVICE_ACCOUNT_PRIVATE_KEY)
    .setClientId(SERVICE_ACCOUNT_EMAIL)
    .setPropertyStore(PropertiesService.getUserProperties())
    .setScope(SCOPE);
  if (!service.hasAccess()) {
    Logger.log('Authentication error: %s', service.getLastError());
    return;
  }
  var url = 'https://chat.googleapis.com/v1/spaces/' + spaceId + '/messages';
  UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + service.getAccessToken() },
    contentType: 'application/json',
    payload: JSON.stringify(chatmessage),
  });
}