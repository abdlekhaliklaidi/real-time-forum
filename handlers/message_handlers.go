package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"
)

var clients = make(map[*websocket.Conn]bool)

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
	fmt.Println("here")
	// Add the new client connection
	clients[conn] = true
	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Println(err)
			delete(clients, conn)
			break
		}

		senderID := 1
		receiverID := 2
		content := string(p) // The actual message content

		if err := SendMessage(senderID, receiverID, content); err != nil {
			log.Println("Error storing message:", err)
		}

		for client := range clients {
			if err := client.WriteMessage(messageType, p); err != nil {
				log.Println(err)
				client.Close()
				delete(clients, client)
			}
		}
	}
}

// SendMessage - function to insert a message into the database
func SendMessage(senderID int, receiverID int, content string) error {
	DB, _ := sql.Open("sqlite3", "forum.db")
	_, err := DB.Exec(`
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
