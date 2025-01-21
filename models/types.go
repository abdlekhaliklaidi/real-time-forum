package models

import (
	"github.com/gorilla/websocket"
)

type Post struct {
	PostID     int
	Author     string
	Title      string
	Content    string
	Categories []string
	Comments   []CommentWithLike
}

type PostWithLike struct {
	Post
	IsLike       int
	LikeCount    int
	DislikeCount int
}

type Comment struct {
	CommentID int
	Content   string
}

type CommentWithLike struct {
	Comment
	IsLike       int
	LikeCount    int
	DislikeCount int
}

type Server struct {
	conns map[*websocket.Conn]bool
	// mu       sync.Mutex
	// upgrader websocket.Upgrader
}
