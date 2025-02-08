document.getElementById('closePopup1').addEventListener('click', function () {
  document.getElementById('chatContainer').style.display = 'none';
  lastSelectUser = null;
});

var input = document.getElementById('input');
var output = document.getElementById('output');
var socket = new WebSocket("ws://localhost:4948/Connections");


var receiverSelect = document.getElementById('receiverSelect');
var sendMessageBtn = document.getElementById('sendMessageBtn');
var receiverContainer = document.querySelector('.receiver-container');


output.classList.add("new-class");

socket.onopen = function () {
  // output.innerHTML += "Status: You are connected\n";


  socket.send(JSON.stringify({ type: 'get_receivers' }));
};

socket.onmessage = function (e) {
  const message = JSON.parse(e.data);
  // console.log(message);
  if (message.type === 'error' && message.content === 'Receiver not online or connection is lost') {
    alert("The recipient is currently offline. Please try again later.");
  }

  // console.log(message);

  if (message.type === 'receivers') {

    receiverSelect.innerHTML = '';
    // default
    var defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Choose a recipient:';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    receiverSelect.appendChild(defaultOption);

    // Selectioner receiver
    message.receivers.forEach(function (receiver) {
      let option = document.createElement('option');
      option.value = receiver.id;
      option.textContent = receiver.username;

      // online
      if (receiver.isConnected) {
        let greenDot = document.createElement('span');
        greenDot.classList.add('green-dot');
        option.appendChild(greenDot);
      }
      receiverSelect.appendChild(option);

    });

    receiverSelect.addEventListener("change", (e) => {
      send(receiverSelect.value)
    })


    receiverContainer.style.display = 'block';
    // output.innerHTML = ''; 
  } else if (message.type === 'message') {
    output.innerHTML += message.content + "\n";
    displayMessage(message);

  } else if (message.type === 'previous_messages') {
    // output.innerHTML = '';
    message.messages.forEach(function (msg) {
      // displayMessage(msg);
      var messageElement = document.createElement('div');
      messageElement.classList.add("message");

      if (msg.type === 'send_message') {
        messageElement.classList.add('sent');
        messageElement.textContent = msg.content;
      } else if (msg.type === 'receive_message') {
        messageElement.classList.add('received');
        messageElement.textContent = msg.content;
      }
      /////Time
      var timeElement = document.createElement('span');
      timeElement.classList.add('message-time');
      var timestamp = new Date(msg.created_at);
      timeElement.textContent = timestamp.toLocaleTimeString();
      messageElement.appendChild(timeElement);

      // var usernameElemnt = document.usernameElemnt('span');
      // usernameElemnt.classList.add('message-username');
      // usernameElemnt.textContent = msg.username.toLocaleTimeString();
      // usernameElemnt.appendChild(usernameElemnt);

      output.insertBefore(messageElement, output.firstChild);
    });
  }
};

let isThrottled = false;

function throttle(callback, delay) {
  if (!isThrottled) {
    callback();
    isThrottled = true;
    setTimeout(() => {
      isThrottled = false;
    }, delay);
  }
}

// pagination
const chatContainer = document.querySelector('.chat-body');

// const throttledLoadMoreMessages = _.throttle(loadMoreMessages, 500);
chatContainer.addEventListener('scroll', function () {
  if (chatContainer.scrollTop < 100) {
    throttle(loadMoreMessages, 500);
  }
});

let offset = 10;

function loadMoreMessages() {
  var selectedReceiver = parseInt(receiverSelect.value);
  if (selectedReceiver) {
    socket.send(JSON.stringify({
      type: 'select_receiver',
      receiverID: selectedReceiver,
      offset: offset
    }));
    offset += 10;
  }
}

let lastSelectUser = null

//// chat
receiverSelect.addEventListener('change', function () {
  if (lastSelectUser != receiverSelect.value) {
    output.innerHTML = '';
    offset = 10;
  }
  // console.log("-----", lastSelectUser, receiverSelect.value);

  lastSelectUser = receiverSelect.value;
  var selectedReceiver = parseInt(receiverSelect.value);

  if (selectedReceiver) {
    let chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) {
      chatContainer = document.createElement('div');
      chatContainer.id = 'chatContainer';
      document.body.appendChild(chatContainer); 
    }

    chatContainer.style.display = 'block';
    var selectedReceiverText = receiverSelect.options[receiverSelect.selectedIndex].text;
    document.getElementById('chatUsername').textContent = selectedReceiverText;

    // output.innerHTML = '';
    socket.send(JSON.stringify({
      type: 'select_receiver',
      receiverID: selectedReceiver
    }));
    loadMoreMessages();

  } else {
    document.getElementById('chatContainer').style.display = 'none';
  }
});

/////// 

document.getElementById('sendMessageBtn').onclick = function () {
  var receiverSelect = document.getElementById('receiverSelect');
  var selectedReceiver = parseInt(receiverSelect.value);
  var messageContent = document.getElementById('input').value;

  if (selectedReceiver && messageContent.trim()) {
    socket.send(JSON.stringify({
      type: 'send_message',
      receiverID: selectedReceiver,
      content: messageContent
    }));

    displayMessage({
      type: 'send_message',
      receiverID: selectedReceiver,
      content: messageContent
    });

    document.getElementById('input').value = '';
  } else {
    alert("Please select a recipient and type a message.");
  }
};

function displayMessage(message) {
// var usernameElemnt = document.createElement('div');
// usernameElemnt.classList.add('message-username');

// if (message.username){
//   usernameElemnt.textContent = message.username.toLocaleTimeString();
// }

// var contentElemente = document.createElement('span');
//   contentElemente.classList.add('message-content');
//   contentElemente.textContent = message.content;

//   messageElement.appendChild(usernameElemnt);
//   messageElement.appendChild(contentElemente);

////////
  var messageElement = document.createElement('div');
  messageElement.classList.add("message");
//////// TIME
  var timeElement = document.createElement('span');
  timeElement.classList.add('message-time');

  if (message.created_at) {
    var timestamp = new Date(message.created_at);
    timeElement.textContent = timestamp.toLocaleTimeString();
  }

  var contentElement = document.createElement('span');
  contentElement.classList.add('message-content');
  contentElement.textContent = message.content;

  messageElement.appendChild(timeElement);
  messageElement.appendChild(contentElement);
////////////
  if (message.type === 'send_message') {
    messageElement.classList.add('sent');
    messageElement.textContent = message.content;
  } else if (message.type === 'receive_message') {
    messageElement.classList.add('received');
    messageElement.textContent = message.content;
  }

  output.appendChild(messageElement);
  output.scrollTop = output.scrollHeight;
 
}

function send(id) {
  var selectedReceiver = parseInt(receiverSelect.value);

  socket.send(JSON.stringify({
    type: "select_receiver",
    receiverID: +id
  }
  ))
  if (selectedReceiver && input.value.trim()) {

    socket.send(JSON.stringify({
      type: 'send_message',
      receiverID: selectedReceiver,
      content: input.value
    }));

    displayMessage({
      type: 'send_message',
      receiverID: selectedReceiver,
      content: input.value
    });

    input.value = "";
  }
}