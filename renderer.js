const Text = require('markov-chains-text').default;
let Worker = require('tiny-worker');
let sqlite3 = require('sqlite3').verbose();
const {remote, clipboard} = require('electron');
const {Menu} = remote;

// Text generator for Markov chain
let textGenerator;
// True if textGenerator is free
let canCreate = false;
// Figure out where the context menu was created
let rightClickPosition = null;

// Right click menu
const InputMenu = Menu.buildFromTemplate([
  {
    label: 'Copy',
    click: () => {
      clipboard.writeText(document.elementFromPoint(rightClickPosition.x, rightClickPosition.y).innerHTML, 'selection')
    }
  },
]);

$(document).ready(() => {
  // Listener for 'Enter' key
  $(document).keypress(function(e) {
    if (e.which == 13 && canCreate) {
      addMessage();
    }
  });

  // Right click on message brings up copy menu
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    rightClickPosition = { x: e.x, y: e.y };
    InputMenu.popup(remote.getCurrentWindow());
  }, false);

  // Add listener for 'Generate Text' button
  $('button.generate').on('click', function() {
    if (canCreate)
      addMessage();
  });

  // Initialize Markov
  let initializeWorker = new Worker(function () {
    self.onmessage = function (ev) {
      postMessage(ev.data);
    };
  });

  initializeWorker.onmessage = function (ev) {
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

      addMessage(`Found ${rows.length.toLocaleString()} messages.  Click 'Generate Text' to generate a text based on the iMessages you've sent in the past!`, true);
      $('button.generate').removeAttr('disabled');
      canCreate = true;
    });
    db.close();

    initializeWorker.terminate();
  };

  initializeWorker.postMessage();

  // Adds a message to the list
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
        // Clean up (zero-width space and object replacement character)
        sentence = sentence.replace(/\u200B/g,'').replace(/\uFFFC/g,'').replace(/^(?:\. *)*(.*)$/, '$1');
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