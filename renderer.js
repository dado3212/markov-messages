const Text = require('markov-chains-text').default;
var Worker = require('tiny-worker');
let textGenerator;
 
let sqlite3 = require('sqlite3').verbose();

let canCreate = false;

$(document).ready(() => {
  addMessage('Building markov chain from iMessages...', true);
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

    addMessage(`Found ${rows.length} messages.  Click 'Generate Text' to generate a text based on the iMessages you've sent in the past!`, true);
    $('button.generate').removeAttr('disabled');
    canCreate = true;

    $(document).keypress(function(e) {
      if (e.which == 13 && canCreate) {
        addMessage();
      }
    });
  });

  db.close();

  // Add listener
  $('button.generate').on('click', function() {
    addMessage();
  });

  function addMessage(text = null, info = false) {
    if (text != null) {
      $('#messages').append('<div class="message ' + (info ? 'info' : '') + '">' + text + '</div>');
      $('#messages').animate({ scrollTop: $('#messages')[0].scrollHeight}, 1000);
    } else if (canCreate) {
      canCreate = false;
      $('#messages').append(`<div class="message ${info ? 'info' : ''} loading"><span></span><span></span><span></span></div>`);
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
        $(`.message.loading`).html(sentence).removeClass('loading');

        canCreate = true;

        // Scroll down
        $('#messages').animate({ scrollTop: $('#messages')[0].scrollHeight}, 100);

        worker.terminate();
      };

      worker.postMessage();
    }
  }
});