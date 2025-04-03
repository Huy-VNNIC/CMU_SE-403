# News System

This is a news management system built with NestJS and MongoDB. It provides APIs for managing news articles, including seeding fake news data, clearing data, and reindexing.

## Prerequisites

- Node.js
- MongoDB
- PNPM (or NPM/Yarn)

## Installation

1. Clone the repository:

    ```sh
    git clone <repository-url>
    cd news-system
    ```

2. Install dependencies:

    ```sh
    pnpm install
    ```

3. Set up MongoDB:

    Ensure MongoDB is running on `mongodb://localhost:27017/news-db`. You can configure this in the [src/app.module.ts](src/app.module.ts) file.

## Running the Application

1. Start the application in development mode:

    ```sh
    pnpm start:dev
    ```

2. The server will be running at `http://localhost:3000`.

3. Access the Swagger API documentation at `http://localhost:3000/api`.
