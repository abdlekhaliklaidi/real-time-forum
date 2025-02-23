package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"forum/database"

	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"
)

var clients = make(map[int]*Clients)

type Clients struct {
	Name string
	conn []*websocket.Conn
}

var clientsMutex sync.Mutex

type Message struct {
	Type       string `json:"type"`
	ReceiverID int    `json:"receiverID"`
	Content    string `json:"content"`
	Offset     int    `json:"offset"`
	CreatedAt  string `json:"created_at"`
	Username   string `json:"username"`
	SenderId   string `json:"senderId"`
}

type Receiver struct {
	ID          int    `json:"id"`
	Username    string `json:"username"`
	IsConnected bool
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// WaitGroup//goroutines
var wg sync.WaitGroup

func addConnection(clientID int, c *websocket.Conn) {
	client, exists := clients[clientID]
	if !exists {
		client = &Clients{
			Name: fmt.Sprintf("Client %d", clientID),
			conn: []*websocket.Conn{},
		}
		clients[clientID] = client
	}
	client.conn = append(client.conn, c)
}

func Connections(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	var userID, offset int

	userID, err = GetUserIDFromSessionToken(w, r)
	if err != nil {
		log.Println("Error retrieving user ID:", err)
		return
	}

	// userID = "7"
	clientsMutex.Lock()
	addConnection(userID, conn)
	// clients[userID] = append(clients[userID], conn)
	clientsMutex.Unlock()
	updateReceiverStatus(userID, true)
	receivers, err := GetReceivers(userID)
	if err != nil {
		log.Println("Error getting receivers:", err)
	}

	var receiversWithStatus []Receiver
	for _, receiver := range receivers {
		receiverStatus := Receiver{
			ID:          receiver.ID,
			Username:    receiver.Username,
			IsConnected: false,
		}

		if receiverConn, exists := clients[receiver.ID]; exists && len(receiverConn.conn) > 0 {
			receiverStatus.IsConnected = true
		}
		receiversWithStatus = append(receiversWithStatus, receiverStatus)
	}
	response := map[string]interface{}{
		"type":      "receivers",
		"receivers": receiversWithStatus,
	}

	err = conn.WriteJSON(response)
	if err != nil {
		log.Println("Error sending receivers:", err)
	}

	for receiverID := range clients {
		if receiverID != userID {
			messages, err := GetMessages(userID, receiverID, offset)
			if err != nil {
				log.Println("Error retrieving messages:", err)
				continue
			}
			err = conn.WriteJSON(messages)
			if err != nil {
				log.Println("Error sending previous messages:", err)
			}
		}
	}

	wg.Add(1)
	go handleMessages(conn, userID)
}

func handleMessages(conn *websocket.Conn, userID int) {
	defer wg.Done()

	for {
		var message Message
		err := conn.ReadJSON(&message)
		if err != nil {
			log.Println("Connection error:", err)

			clientsMutex.Lock()

			for i, c := range clients[userID].conn {
				if c == conn {
					clients[userID].conn = append(clients[userID].conn[:i], clients[userID].conn[i+1:]...)
					break
				}
			}

			if len(clients[userID].conn) == 0 {
				delete(clients, userID)
			}
			// delete(clients, userID)

			clientsMutex.Unlock()
			updateReceiverStatus(userID, false)
			break
		}
		if message.Type == "typing" || message.Type == "stop_typing" {
			receiverID := message.ReceiverID
			receiverConn, exists := clients[receiverID]
			if exists && receiverConn != nil {
				message.SenderId = strconv.Itoa(userID)
				for _, val := range receiverConn.conn {
					err := val.WriteJSON(message)
					if err != nil {
						log.Println("Error sending error to sender:", err)
					}
				}
			}
			continue
		}
		/////
		if message.Type == "select_receiver" {
			receiverID := message.ReceiverID

			messages, err := GetMessages(userID, receiverID, message.Offset)
			if err != nil {
				log.Println("Error retrieving messages:", err)
				continue
			}

			response := map[string]interface{}{
				"type":     "previous_messages",
				"messages": messages,
			}
			err = conn.WriteJSON(response)
			if err != nil {
				log.Println("Error sending previous messages:", err)
			}
		}
		//////

		switch message.Type {
		case "send_message":
			receiverID := message.ReceiverID
			content := message.Content

			if receiverID == userID {
				errorResp := map[string]interface{}{
					"type":    "error",
					"content": "You cannot send a message to yourself.",
				}
				err := conn.WriteJSON(errorResp)
				if err != nil {
					log.Println("Error sending error to sender:", err)
				}
				continue
			}

			receiverConn, exists := clients[receiverID]
			if !exists || receiverConn == nil {

				log.Printf("Receiver %d not connected or connection is nil", receiverID)
				errorResp := map[string]interface{}{
					"type":    "error",
					"content": "Receiver not online or connection is lost",
				}
				err := conn.WriteJSON(errorResp)
				if err != nil {
					log.Println("Error sending error to sender:", err)
				}
				err = SendMessage(userID, receiverID, content)
				if err != nil {
					log.Println("Error saving message to database:", err)
				}
				continue
			}

			resp := map[string]interface{}{
				"type":       "message",
				"username":   message.Username,
				"content":    content,
				"created_at": time.Now().Format(time.RFC3339),
				// "IsConnected": true,
				"senderId": userID,
			}
			for _, val := range receiverConn.conn {
				err = val.WriteJSON(resp)
				if err != nil {
					log.Println("Error sending message to receiver:", err)
				}
			}

			err = SendMessage(userID, receiverID, content)
			if err != nil {
				log.Println("Error saving message to database:", err)
			}
		}
	}
}

func updateReceiverStatus(receiverID int, isConnected bool) {
	clientsMutex.Lock()
	defer clientsMutex.Unlock()

	for _, client := range clients {
		response := map[string]interface{}{
			"type":        "status-update",
			"receiverID":  receiverID,
			"isConnected": isConnected,
		}
		for _, val := range client.conn {
			err := val.WriteJSON(response)
			if err != nil {
				log.Println("Error sending status update:", err)
			}

		}
	}
}

func GetReceivers(userID int) ([]Receiver, error) {
	DB, err := sql.Open("sqlite3", "forum.db")
	if err != nil {
		return nil, err
	}
	defer DB.Close()

	query := `WITH last_messages AS (
        SELECT
            u.id AS user_id,
            u.username,
            COALESCE(m.sender_id, 0) as last_message_sender,
            COALESCE(strftime('%Y-%m-%dT%H:%M:%SZ', m.created_at), "") AS sort_time
        FROM
            users u
        LEFT JOIN messages m
            ON m.id = (
                SELECT id
                FROM messages
                WHERE ((sender_id = u.id AND receiver_id = $1 ) OR (sender_id = $1 AND receiver_id= u.id))
                ORDER BY created_at DESC
                LIMIT 1
            )
        WHERE
            u.id != $1
    )
    SELECT
        user_id AS id,
        username
    FROM
        last_messages
    ORDER BY
        CASE
            WHEN sort_time = "" THEN 1 
            ELSE 0
        END,
        sort_time DESC,
        username ASC; `

	rows, err := DB.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var receivers []Receiver
	for rows.Next() {
		var receiver Receiver
		err := rows.Scan(&receiver.ID, &receiver.Username)
		if err != nil {
			return nil, err
		}
		receivers = append(receivers, receiver)
	}
	return receivers, nil
}

func GetMessages(senderID, receiverID, offset int) ([]Message, error) {
	DB, err := sql.Open("sqlite3", "forum.db")
	if err != nil {
		log.Printf("Error opening database: %v", err)
		return nil, err
	}
	defer DB.Close()
	rows, err := DB.Query(`
    SELECT messages.sender_id, messages.receiver_id, messages.content, messages.created_at, users.username
    FROM messages 
	LEFT JOIN users ON messages.sender_id = users.id
    WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
    ORDER BY messages.created_at DESC, messages.id DESC
    LIMIT 10 OFFSET $3`, senderID, receiverID, offset)
	if err != nil {
		log.Printf("Error querying messages: %v", err)
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var message Message
		var senderIDI, receiverIDI int
		var content, createdAt, username string

		err := rows.Scan(&senderIDI, &receiverIDI, &content, &createdAt, &username)
		if err != nil {
			log.Printf("Error scanning message: %v", err)
			return nil, err
		}

		if senderIDI == senderID {
			message.Type = "send_message"
			message.ReceiverID = receiverID
		} else {
			message.Type = "receive_message"
			message.ReceiverID = senderID
		}
		message.Content = content
		message.CreatedAt = createdAt
		message.Username = username

		messages = append(messages, message)
	}

	return messages, nil
}

func SendMessage(senderID int, receiverID int, content string) error {
	DB, err := sql.Open("sqlite3", "forum.db")
	if err != nil {
		log.Printf("Error opening database: %v", err)
		return err
	}
	defer DB.Close()

	_, err = DB.Exec(`
        INSERT INTO messages (sender_id, receiver_id, content)
        VALUES (?, ?, ?)`,
		senderID, receiverID, content,
	)
	if err != nil {
		log.Printf("Error sending message: %v", err)
		return err
	}
	log.Println("Message sent successfully")
	return nil
}

func GetUserIDFromSessionToken(w http.ResponseWriter, r *http.Request) (int, error) {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		return 0, fmt.Errorf("session token not found: %v", err)
	}

	var userID int
	err = database.DB.QueryRow("SELECT id FROM users WHERE session_token = ?", cookie.Value).Scan(&userID)
	if err == sql.ErrNoRows {
		return 0, fmt.Errorf("session not valid or expired")
	} else if err != nil {
		return 0, fmt.Errorf("database error: %v", err)
	}

	return userID, nil
}
