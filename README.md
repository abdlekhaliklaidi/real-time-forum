**Real-Time Forum – README**

## **📌 Présentation**

Ce projet consiste à créer un **forum en temps réel**, plus complet et plus avancé que le précédent.
Il doit intégrer :

* Un système d’inscription et connexion
* La création de posts
* Les commentaires
* Un système de **messages privés en temps réel** via WebSockets
* Une interface en **Single Page Application (SPA)** en JavaScript
* Une base de données SQLite
* Un backend en Go
* Un frontend en HTML/CSS/JS pur (aucun framework)

Ce projet combine les concepts de backend, frontend, WebSockets, sessions, gestion du DOM et communication en temps réel.

---

## **✨ Fonctionnalités**

### 🔐 **1. Authentification (Inscription & Connexion)**

L’utilisateur doit pouvoir :

* S'inscrire via un formulaire contenant :

  * Nickname
  * Âge
  * Genre
  * Prénom
  * Nom
  * Email
  * Mot de passe
* Se connecter avec **email OU nickname + mot de passe**
* Se déconnecter depuis n’importe quelle page
* Accéder au forum uniquement s'il est connecté
* Voir une page login/register s’il est déconnecté

---

### 📝 **2. Posts & Commentaires**

Les fonctionnalités du forum précédent doivent exister :

* Création de posts
* Les posts ont des **catégories**
* Affichage des posts dans un **feed**
* Création de commentaires associés à un post
* Les commentaires ne sont visibles que lorsque l'utilisateur clique sur un post

---

### 💬 **3. Messages Privés (Temps Réel)**

Le forum doit intégrer un **système de messagerie privée**, semblable à Discord :

#### 📍 Section “Liste des utilisateurs”

* Affiche les utilisateurs **en ligne / hors ligne**
* Toujours visible (sidebar)
* Triée par :

  * Dernier message échangé
  * Et sinon ordre alphabétique

#### 💬 Section “Chat”

* Lorsqu’on clique sur un utilisateur :

  * Les **anciens messages** sont chargés
  * Affichage des messages :

    * date
    * auteur
    * contenu
* Le chat doit fonctionner **en temps réel** grâce aux WebSockets :

  * Lorsque User A envoie un message → User B le reçoit instantanément, sans refresh

#### 🔄 Chargement infini (Message history)

* Le chat doit charger les **10 derniers messages**
* En scrollant vers le haut → charger 10 messages supplémentaires
* Pas de spam du scroll event → utiliser **Throttle/Debounce**

---

## **🗄️ Base de données (SQLite)**

Toutes les données doivent être stockées dans SQLite :

* Utilisateurs
* Posts
* Commentaires
* Messages privés
* Catégories de posts
* Sessions / Cookies (si nécessaire)

---

## **🧠 Backend (Go)**

Le backend en Go gère :

* Sessions et cookies
* Authentification
* Les WebSockets
* Le stockage et récupération des données SQLite
* Les routes HTTP
* La diffusion des messages en temps réel
* L'organisation des chats entre utilisateurs

Packages autorisés :

* `database/sql`
* `gorilla/websocket`
* `sqlite3`
* `bcrypt`
* `uuid`
* Tous les packages standards

---

## **🎨 Frontend (HTML / CSS / JS)**

### 🧩 Single Page Application

➡️ **Un seul fichier HTML**
Toute la navigation (pages Login, Register, Forum, Chat, Post, etc.) doit être gérée en JavaScript en modifiant le DOM.

### 📡 WebSockets côté JS

* Connexion WebSocket à `/ws`
* Envoi et réception des messages
* Mise à jour automatique du chat en direct

## **🚀 Exécution du projet**

### 1️⃣ Lancer le serveur Go

```sh
go run server/main.go
