var input = document.getElementById('input');
var output = document.getElementById('output');
var socket = new WebSocket("ws://localhost:4848/Connections");
// console.log("iscoonicted");

var receiverSelect = document.getElementById('receiverSelect');
var sendMessageBtn = document.getElementById('sendMessageBtn');
var receiverContainer = document.querySelector('.receiver-container');


output.classList.add("new-class");

socket.onopen = function () {
  output.innerHTML += "Status: You are connected\n";


  socket.send(JSON.stringify({ type: 'get_receivers' }));
};

socket.onmessage = function (e) {
  const message = JSON.parse(e.data);
  // console.log(message);
  // if (message.type === 'error' && message.content === 'Receiver not online or connection is lost') {
  //   alert("The recipient is currently offline. Please try again later.");
  // }
  console.log(message);

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
      // option.textContent = receiver.username + (receiver.isConnected ? ' (Online)' : ' (Offline)');
      // option.dataset.isConnected = receiver.isConnected;
      option.textContent = receiver.username;
      receiverSelect.appendChild(option);

    });

    receiverSelect.addEventListener("change", (e) => {
      send(receiverSelect.value)
    })


    receiverContainer.style.display = 'block';
  } else if (message.type === 'message') {
    output.innerHTML += message.content + "\n";
    displayMessage(message);

  } else if (message.type === 'previous_messages') {
    message.messages.forEach(function (msg) {
      displayMessage(msg);
    });
  }
};
// pagination
const chatContainer = document.getElementById('chatContainer');
chatContainer.addEventListener('scroll', function() {
  if (chatContainer.scrollTop === 0) {
    loadMoreMessages(); 
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

//// chat
receiverSelect.addEventListener('change', function () {
  var selectedReceiver = parseInt(receiverSelect.value);

  if (selectedReceiver) {
    document.getElementById('chatContainer').style.display = 'block';
    var selectedReceiverText = receiverSelect.options[receiverSelect.selectedIndex].text;
    document.getElementById('chatUsername').textContent = selectedReceiverText;

    socket.send(JSON.stringify({
      type: 'select_receiver',
      receiverID: selectedReceiver
    }));
  } else {
    document.getElementById('chatContainer').style.display = 'none';
  }
});

/////// 

document.getElementById('sendMessageBtn').onclick = function () {
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
  var messageElement = document.createElement('div');
  messageElement.classList.add("message");

  if (message.type === 'send_message') {
    messageElement.classList.add('sent');
    messageElement.textContent = message.content;
  } else if (message.type === 'receive_message') {
    messageElement.classList.add('received');
    messageElement.textContent = "Received: " + message.content;
  }

  output.appendChild(messageElement);
  output.scrollTop = output.scrollHeight;
  // output.insertBefore(messageElement, output.firstChild);
  // output.scrollTop = output.scrollHeight;
}

function send(id) {
  var selectedReceiver = parseInt(receiverSelect.value);
  // var selectedReceiverOption = receiverSelect.options[receiverSelect.selectedIndex];
  // var isReceiverConnected = selectedReceiverOption ? selectedReceiverOption.dataset.isConnected === 'true' : false;
  socket.send(JSON.stringify({
    type: "select_receiver",
    receiverID: +id
  }
  ))
  if (selectedReceiver && input.value.trim()) {

    // if (!isReceiverConnected) {
    //   alert("The recipient is currently offline. Please try again later.");
    //   return;
    // }

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