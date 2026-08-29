# Bookshelf — Server

Backend API for **Bookshelf**, a full-stack library management platform featuring books, reviews, events, news, users, notifications, and admin messaging.

## Overview

This repository contains the backend application responsible for managing Bookshelf's application data and RESTful API services.

It handles communication between the frontend and MongoDB database while supporting user management, library content, reviews, events, news, and the application's conversation system.

## Features

* RESTful API
* User management
* Role-based user system
* Book management
* Review and rating management
* Events management
* News management
* Conversation management
* Admin-to-user messaging
* Message inbox support
* Read/seen message status
* Unread notification support
* Search and filtering
* MongoDB database integration

## User Roles

```text
Admin
Member
Volunteer
```

Role-based authorization is used to control access to protected operations.

## Messaging & Conversation System

The backend supports the application's messaging workflow, including:

* Admin-to-user conversations
* Conversation history
* Message polling
* Read/seen status
* Unread message tracking
* Conversation continuation

## Technologies

* Node.js
* Express.js
* MongoDB
* JavaScript
* REST API
* Firebase Authentication integration

## Architecture

```text
Bookshelf Client
       │
       │ REST API
       ▼
Bookshelf Server
       │
       ▼
    MongoDB
```

## API Responsibilities

The backend provides endpoints for:

* Users
* Books
* Reviews
* Events
* News
* Conversations
* Messages
* Notifications
* Change Role

## Security

Protected operations use authentication and role-based authorization.

Sensitive configuration is managed through environment variables and is not stored in the repository.

## Related Repository

**Frontend:** [Bookshelf Client](https://github.com/md-toybur-rahman/bookshelf_client)

## Project Status

**Completed**

## Developer

**Toybur Rahman**

Full-Stack Web Developer

