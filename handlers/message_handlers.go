package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"forum/database"

	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"
)

// var clients = make(map[*websocket.Conn]bool)

var clients = make(map[string]*websocket.Conn)

type Message struct {
	Type       string `json:"type"`
	ReceiverID string `json:"receiverID,omitempty"`
	Content    string `json:"content,omitempty"`
}

type Receiver struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

func Connections(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	// defer conn.Close()

	var userID string
	// _, p, err := conn.ReadMessage()
	// if err != nil {
	// 	log.Println("Error reading initial message:", err)
	// 	return
	// }

	userID, err = GetUserIDFromSessionToken(w, r)
	// fmt.Println(GetUserIDFromSessionToken)
	if err != nil {
		log.Println("Error retrieving user ID:", err)
		return
	}
	// userID = "7"
	// log.Println("Adding client", userID)
	clients[userID] = conn

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

	messages, err := GetMessages(userID)
	if err != nil {
		log.Println("Error retrieving messages:", err)
	}

	for _, msg := range messages {
		err := conn.WriteJSON(msg)
		if err != nil {
			log.Println("Error sending message:", err)
		}
	}

	for {
		_, messageData, err := conn.ReadMessage()
		if err != nil {
			log.Println(err)
			delete(clients, userID)
			break
		}

		var message Message
		err = json.Unmarshal(messageData, &message)
		if err != nil {
			log.Println("Error unmarshalling message:", err)
			continue
		}

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
				return
			}

			resp := map[string]interface{}{
				"type":    "message",
				"content": content,
			}

			receiverConn, exists := clients[receiverID]
			if exists {
				err := receiverConn.WriteJSON(resp)
				if err != nil {
					log.Println("Error sending message to receiver:", err)
				}
			} else {
				log.Println("Receiver not connected:", receiverID)
				errorResp := map[string]interface{}{
					"type":    "error",
					"content": "Receiver not online",
				}
				err := conn.WriteJSON(errorResp)
				if err != nil {
					log.Println("Error sending error to sender:", err)
				}
				continue
			}

			err := SendMessage(userID, receiverID, content)
			if err != nil {
				log.Println("Error sending message:", err)
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

func GetMessages(userID string) ([]Message, error) {
	DB, err := sql.Open("sqlite3", "forum.db")
	if err != nil {
		log.Printf("Error opening database: %v", err)
		return nil, err
	}
	defer DB.Close()

	rows, err := DB.Query(`
		SELECT sender_id, receiver_id, content 
		FROM messages 
		WHERE sender_id = ? OR receiver_id = ?`, userID, userID)
	if err != nil {
		log.Printf("Error querying messages: %v", err)
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var message Message
		var senderID, receiverID, content string
		err := rows.Scan(&senderID, &receiverID, &content)
		if err != nil {
			log.Printf("Error scanning message: %v", err)
			return nil, err
		}

		if senderID == userID {
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

func SendMessage(senderID string, receiverID string, content string) error {
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

func GetUserIDFromSessionToken(w http.ResponseWriter, r *http.Request) (string, error) {
	cookie, err := r.Cookie("session_token")
	if err != nil {
		return "", fmt.Errorf("session token not found: %v", err)
	}

	var userID string
	err = database.DB.QueryRow("SELECT id FROM users WHERE session_token = ?", cookie.Value).Scan(&userID)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("session not valid or expired")
	} else if err != nil {
		return "", fmt.Errorf("database error: %v", err)
	}

	return userID, nil
}
