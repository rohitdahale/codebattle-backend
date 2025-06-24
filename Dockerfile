# Base image
FROM node:18

# Set working directory inside container
WORKDIR /app

# Copy dependencies
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Expose port
EXPOSE 5000

# Start the server
CMD ["node", "app.js"]
