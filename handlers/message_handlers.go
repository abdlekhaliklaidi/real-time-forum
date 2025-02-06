package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"sync"

	"forum/database"

	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"
)

var clients = make(map[int]*websocket.Conn)

var clientsMutex sync.Mutex

type Message struct {
	Type       string `json:"type"`
	ReceiverID int    `json:"receiverID"`
	Content    string `json:"content"`
	Offset     int    `json:"offset"`
}

type Receiver struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// WaitGroup//goroutines
var wg sync.WaitGroup

func Connections(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	var userID, offset int

	userID, err = GetUserIDFromSessionToken(w, r)
	// fmt.Println(GetUserIDFromSessionToken)
	if err != nil {
		log.Println("Error retrieving user ID:", err)
		return
	}

	// userID = "7"
	// log.Println("Adding client", userID)
	clientsMutex.Lock()
	clients[userID] = conn
	clientsMutex.Unlock()

	receivers, err := GetReceivers()
	if err != nil {
		log.Println("Error getting receivers:", err)
	}

	response := map[string]interface{}{
		"type":      "receivers",
		"receivers": receivers,
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
			delete(clients, userID)
			clientsMutex.Unlock()
			break
		}

		/////
		if message.Type == "select_receiver" {
			receiverID := message.ReceiverID
			// fmt.Println(offset, "strring")
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
				continue
			}

			resp := map[string]interface{}{
				"type":    "message",
				"content": content,
			}

			err = receiverConn.WriteJSON(resp)
			if err != nil {
				log.Println("Error sending message to receiver:", err)
			}

			err = SendMessage(userID, receiverID, content)
			if err != nil {
				log.Println("Error saving message to database:", err)
			}
		}
	}
}

func GetReceivers() ([]Receiver, error) {
	DB, err := sql.Open("sqlite3", "forum.db")
	if err != nil {
		return nil, err
	}
	defer DB.Close()

	rows, err := DB.Query("SELECT id, username FROM users")
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
    SELECT sender_id, receiver_id, content, created_at
    FROM messages 
    WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
    ORDER BY created_at DESC, id DESC
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
		var content, timestamp string

		err := rows.Scan(&senderIDI, &receiverIDI, &content, &timestamp)
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
