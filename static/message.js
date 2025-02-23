var typingTimer;
var typingInterval = 1000;
var lastMessageTimes = {};

document.addEventListener('DOMContentLoaded', function () {
  const input = document.getElementById('input');
  const typingStatus = document.getElementById('typingStatus');
  if (input) {
    input.addEventListener('input', function () {
      clearTimeout(typingTimer);

      // Show typing status only if there's a selected receiver
      if (lastSelectUser) {
        socket.send(JSON.stringify({
          type: 'typing',
          receiverID: lastSelectUser,
          username: localStorage.getItem("username")
        }));
      }

      typingTimer = setTimeout(function () {
        // Stop typing if there's a selected receiver
        if (lastSelectUser) {
          socket.send(JSON.stringify({
            type: 'stop_typing',
            receiverID: lastSelectUser
          }));
        }
        typingStatus.style.display = 'none';
      }, typingInterval);
    });
  } else {
    console.error('Input element not found');
  }
});


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
  socket.send(JSON.stringify({ type: 'get_receivers' }));
};

socket.onmessage = function (e) {

  const message = JSON.parse(e.data);
  // console.log(message);
  if (message.type == "reload") {
    window.location.reload()
  }
  if (message.type === 'typing') {

    if (message.senderId == lastSelectUser) {
      // console.log(lastSelectUser);
      document.getElementById('typingStatus').style.display = 'block';
      document.getElementById('typingStatus').textContent = `${message.username} is typing`;
      typingStatus.classList.add('show');

    }
  } else if (message.type == 'stop_typing') {
    if (message.senderId == lastSelectUser) {
      document.getElementById('typingStatus').style.display = 'none';
      typingStatus.classList.remove('show');
    }
  }
  if (message.type === 'status-update') {
    const receiverElement = document.querySelector(`li[data-value="${message.receiverID}"]`);

    if (receiverElement) {
      const statusDot = receiverElement.querySelector('span');

      if (message.isConnected) {
        statusDot.classList.remove('red-dot');
        statusDot.classList.add('green-dot');
      } else {
        statusDot.classList.remove('green-dot');
        statusDot.classList.add('red-dot');
      }
    }
  }

  // if (message.type === 'error' && message.content === 'Receiver not online or connection is lost') {
  //   alert("The recipient is currently offline. Please try again later.");
  // }

  if (message.type === 'receivers') {
    receiverSelect.innerHTML = '';

    if (Array.isArray(message.receivers)) {
      let sortedReceivers = message.receivers.map((receiver) => {
        return {
          ...receiver,
          lastMessageTime: lastMessageTimes[receiver.id] || 0
        };
      });

      sortedReceivers.forEach(function (receiver) {
        let listItem = document.createElement('li');
        listItem.dataset.value = receiver.id;

        let statusDot = document.createElement('span');

        if (receiver.IsConnected) {
          statusDot.classList.add('green-dot');
        } else {
          statusDot.classList.add('red-dot');
        }
        listItem.appendChild(statusDot);

        let usernameText = document.createElement('span');
        usernameText.textContent = receiver.username;
        listItem.appendChild(usernameText);

        listItem.addEventListener('click', () => {
          selectReceiver(receiver.id);
        });
        receiverSelect.appendChild(listItem);
      });

      receiverContainer.style.display = 'block';
    } else {
      console.error('message.receivers is not an array:', message.receivers);
    }
  } else if (message.type === 'typing') {
    document.getElementById('typingStatus').style.display = 'block';

  }

  if (message.type === 'message') {
    lastMessageTimes[message.receiverID] = new Date(message.created_at).getTime();

    const receiverElement = document.querySelector(`[data-value="${message.senderId}"]`);
    
    if (receiverElement) {
      receiverSelect.removeChild(receiverElement);
  
      receiverSelect.insertBefore(receiverElement, receiverSelect.firstChild);
    }

    if (message.senderId === lastSelectUser) {
      displayMessage(message);
    } else {
      MessageNotification(message);

    }
    // lastMessageTimes[message.receiverID] = new Date(message.created_at).getTime();
    document.getElementById('typingStatus').style.display = 'none';

  } else if (message.type === 'previous_messages' && message.messages && Array.isArray(message.messages)) {
    message.messages.forEach((msg) => {
      // displayMessage(msg);
      var messageElement = document.createElement('div');
      messageElement.classList.add("message");

      var usernameElement = document.createElement('span');
      usernameElement.classList.add('message-username');
      usernameElement.textContent = msg.username;
      if (msg.type === 'send_message') {
        messageElement.classList.add('sent');
      } else if (msg.type === 'receive_message') {
        messageElement.classList.add('received');
      }
      const div = document.createElement("div")
      div.className = "message-content"
      div.textContent = msg.content;
      /////Time
      messageElement.appendChild(usernameElement);
      messageElement.appendChild(div)
      var timeElement = document.createElement('span');
      timeElement.classList.add('message-time');
      var timestamp = new Date(msg.created_at);
      timeElement.textContent = timestamp.toLocaleTimeString();
      messageElement.appendChild(timeElement);

      output.prepend(messageElement);

      lastMessageTimes[msg.receiverID] = new Date(msg.created_at).getTime();

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
chatContainer.addEventListener('scroll', function () {
  if (chatContainer.scrollTop < 100) {
    throttle(loadMoreMessages, 500);
  }
});

let offset = 10;

function loadMoreMessages() {
  var selectedReceiver = lastSelectUser;
  offset += 10;
  if (selectedReceiver) {
    socket.send(JSON.stringify({
      type: 'select_receiver',
      receiverID: selectedReceiver,
      offset: offset
    }));

  }
}

let lastSelectUser = null

//// chat
function selectReceiver(receiverId) {
  if (lastSelectUser != receiverId) {
    output.innerHTML = '';
    offset = 0;
  } else if (lastSelectUser === receiverId) {
    return;
  }

  lastSelectUser = receiverId;
  // console.log(lastSelectUser);

  if (receiverId) {
    let chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) {
      chatContainer = document.createElement('div');
      chatContainer.id = 'chatContainer';
      document.body.appendChild(chatContainer);
    }

    chatContainer.style.display = 'block';

    var selectedReceiverText = document.querySelector(`li[data-value="${receiverId}"]`).textContent;
    if (document.getElementById('chatUsername'))
      document.getElementById('chatUsername').textContent = selectedReceiverText;

    socket.send(JSON.stringify({
      type: 'select_receiver',
      receiverID: receiverId,
      offset: offset
    }));

  } else {
    document.getElementById('chatContainer').style.display = 'none';
  }
}

document.getElementById('sendMessageBtn').onclick = function () {
  var messageContent = input.value.trim();

  if (lastSelectUser && messageContent) {
    socket.send(JSON.stringify({
      type: 'send_message',
      receiverID: lastSelectUser,
      content: messageContent,
      username: localStorage.getItem("username")
    }));

    lastMessageTimes[lastSelectUser] = new Date().getTime();

    offset += 10;

    let sortedReceivers = Array.from(receiverSelect.children).map((item) => {
      const receiverId = item.dataset.value;
      return {
        id: receiverId,
        lastMessageTime: lastMessageTimes[receiverId] || 0,
        element: item
      };
    });

    sortedReceivers.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

    receiverSelect.innerHTML = '';
    sortedReceivers.forEach((receiver) => {
      receiverSelect.appendChild(receiver.element);
    });

    displayMessage({
      type: 'send_message',
      receiverID: lastSelectUser,
      content: messageContent
    });

    input.value = '';
  } else {
    alert("Please select a recipient and type a message.");
  }
};

function displayMessage(message) {
  console.log(message.created_at)
  var messageElement = document.createElement('div');
  messageElement.classList.add("message");
  // /////////username
  var usernameElement = document.createElement('span');
  usernameElement.classList.add('message-username');
  if (message.username) {
    usernameElement.innerHTML = message.username;
  } else {
    usernameElement.innerHTML = localStorage.getItem("name");
  }
  messageElement.append(usernameElement);

  //////// TIME
  var timeElement = document.createElement('span');
  timeElement.classList.add('message-time');

  if (message.created_at) {
    var timestamp = new Date(message.created_at);
    timeElement.textContent = timestamp.toLocaleTimeString();
  } else {
    var timestamp = new Date();
    timeElement.textContent = timestamp.toLocaleTimeString();
  }

  var contentElement = document.createElement('span');
  contentElement.classList.add('message-content');
  contentElement.textContent = message.content;

  messageElement.append(contentElement);
  ////////////
  messageElement.append(timeElement);

  if (message.type === 'send_message') {
    messageElement.classList.add('sent');
    // messageElement.textContent = message.content;
  } else if (message.type === 'receive_message' || message.type === 'message') {
    messageElement.classList.add('received');
    // messageElement.textContent = message.content;
  }
  // console.log(output, messageElement)
  output.append(messageElement);
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
      content: input.value,
      // created_at : new Date()
    });

    input.value = "";
  }
}

function MessageNotification(message) {
  const notification = document.createElement('div');
  notification.classList.add('message-notification');
  notification.textContent = `${message.username} I send you a new message!`;

  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.opacity = 0;
    setTimeout(() => {
      notification.remove();
    }, 1000);
  }, 3000);
}

function toggleReceiverContainer() {
  const receiverContainer = document.querySelector('.receiver-container');
  receiverContainer.classList.toggle('expanded');
}

const receiverButton = document.querySelector('.receiver-container');
receiverButton.addEventListener('click', toggleReceiverContainer);
