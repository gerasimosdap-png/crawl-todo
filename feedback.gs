/**
 * CRAWL — free feedback collector (Google Apps Script).
 * Deploy as a Web App ("Execute as: Me", "Who has access: Anyone").
 * The themed form POSTs (fetch) to this same /exec endpoint; doPost writes
 * each submission to the attached Google Sheet. Paste the /exec URL into
 * CRAWL: Settings -> Feedback.
 */

function doGet() {
  var url = ScriptApp.getService().getUrl();
  return HtmlService.createHtmlOutput(FORM_HTML.replace(/__EXEC__/g, url))
    .setTitle('CRAWL feedback')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Rating', 'Message', 'Contact']);
    }
    var p = (e && e.parameter) || {};
    sheet.appendRow([new Date(), p.rating || '', p.message || '', p.contact || '']);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error');
  }
}

var FORM_HTML =
'<style>' +
'  body{background:#0b0e12;color:#e8edf3;font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:24px;}' +
'  .card{max-width:460px;margin:0 auto;}' +
'  h1{font-size:22px;margin:0 0 4px;} .sub{color:#95a3b3;font-size:14px;margin-bottom:20px;}' +
'  label{display:block;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#5fd896;margin:16px 2px 6px;}' +
'  textarea,input,select{width:100%;box-sizing:border-box;padding:12px;border-radius:11px;border:1px solid #28323f;background:#161d26;color:#e8edf3;font-size:16px;}' +
'  textarea{min-height:120px;resize:vertical;}' +
'  button{width:100%;margin-top:20px;padding:14px;border:none;border-radius:12px;background:#5fd896;color:#06231a;font-size:15px;font-weight:700;cursor:pointer;}' +
'  button:disabled{opacity:.6;}' +
'  .b{color:#5fd896;font-family:monospace;letter-spacing:4px;font-size:13px;}' +
'</style>' +
'<div class="card" id="card">' +
'  <h1>Feedback for CRAWL</h1>' +
'  <div class="sub">Tell me what you love, what is confusing, and what is missing. Thank you, Crawler.</div>' +
'  <label>How is it so far?</label>' +
'  <select id="rating"><option value="">-</option><option>Love it</option><option>Good</option><option>Okay</option><option>Needs work</option></select>' +
'  <label>Your thoughts</label>' +
'  <textarea id="message" placeholder="What worked, what did not, ideas..."></textarea>' +
'  <label>Contact (optional)</label>' +
'  <input id="contact" placeholder="email, so I can follow up" />' +
'  <button id="btn" type="button" onclick="send()">Send feedback</button>' +
'</div>' +
'<script>' +
'function send(){' +
'  var m=document.getElementById("message").value.trim();' +
'  if(!m){alert("Please add a few words first.");return;}' +
'  var b=document.getElementById("btn");b.disabled=true;b.textContent="Sending...";' +
'  var body=new URLSearchParams();' +
'  body.append("rating",document.getElementById("rating").value);' +
'  body.append("message",m);' +
'  body.append("contact",document.getElementById("contact").value);' +
'  fetch("__EXEC__",{method:"POST",mode:"no-cors",body:body})' +
'   .then(function(){document.getElementById("card").innerHTML=' +
'     "<div class=\\"b\\">THE SYSTEM</div><h1>Feedback received.</h1><p style=\\"color:#95a3b3\\">The dungeon grows stronger. You may close this tab.</p>";})' +
'   .catch(function(){b.disabled=false;b.textContent="Send feedback";alert("Could not send. Please try again.");});' +
'}' +
'<\/script>';
