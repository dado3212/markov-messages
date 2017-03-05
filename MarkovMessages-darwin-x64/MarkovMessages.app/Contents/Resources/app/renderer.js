const Text = require('markov-chains-text').default;
var Worker = require('tiny-worker');
let textGenerator;
 
let sqlite3 = require('sqlite3').verbose();

let messageNum = 0;

$(document).ready(() => {
  addMessage('Building markov chain from chat messages...', true);
  // Open the chat database
  let db = new sqlite3.Database(`${process.env.HOME}/Library/Messages/chat.db`);

  // Pull all of your personal texts
  db.all('SELECT text FROM message WHERE text != "" AND is_from_me = 1', function(err, rows) {
    let fullText = "";
    rows.forEach(row => {
      let text = row.text;
      if ("?!.".includes(text.slice(-1))) {
        fullText += text + " ";
      } else {
        fullText += text + ". ";
      }
    });

    // Create the generator
    textGenerator = new Text(fullText);

    addMessage(`Found ${rows.length} messages.  Click 'Generate Messsage' to generate a message!`, true);
    $('button.generate').removeAttr('disabled');
  });

  db.close();

  // Add listener
  $('button.generate').on('click', function() {
    addMessage();
  });

  $(document).keypress(function(e) {
    e.preventDefault();
    if (e.which == 13) {
      if (!$('button.generate').is(':disabled')) {
        addMessage();
      }
    }
  });

  function addMessage(text = null, info = false) {
    if (text != null) {
      $('#messages').append('<div class="message ' + (info ? 'info' : '') + '">' + text + '</div>');
      $('#messages').animate({ scrollTop: $('#messages')[0].scrollHeight}, 1000);
    } else {
      messageNum += 1;
      $('#messages').append(`<div class="message ${info ? 'info' : ''} loading" data-count=${messageNum}><span></span><span></span><span></span></div>`);
      $('#messages').animate({ scrollTop: $('#messages')[0].scrollHeight}, 1000);
      let worker = new Worker(function () {
        self.onmessage = function (ev) {
          postMessage(ev.data);
        };
      });

      worker.onmessage = function (ev) {
        // Generate a new sentence
        let sentence = textGenerator.makeSentence();
        while (sentence instanceof Error) { // Ensure it doesn't fail
          sentence = textGenerator.makeSentence();
        }
        // Clean up
        sentence = sentence.replace(/\u200B/g,'').replace(/^(?:\. *)*(.*)$/, '$1');
        $(`.message.loading[data-count=${ev.data}]`).html(sentence).removeClass('loading').removeAttr('data-count');

        messageNum -= 1;

        // Scroll down
        $('#messages').animate({ scrollTop: $('#messages')[0].scrollHeight}, 100);

        worker.terminate();
      };

      worker.postMessage(messageNum);
    }
  }
});