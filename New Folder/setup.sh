#!/bin/bash

# SCEAP 2.0 Setup Script
# This script initializes the development environment

echo "================================"
echo "SCEAP 2.0 Setup Script"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Backend Setup
echo -e "${BLUE}[1/4] Setting up Backend (.NET Core)...${NC}"
cd sceap-backend
echo "Restoring dependencies..."
dotnet restore
echo ""
echo "Creating database..."
dotnet ef database drop -f 2>/dev/null
dotnet ef database update
echo -e "${GREEN}✓ Backend ready!${NC}"
echo ""

# Frontend Setup
echo -e "${BLUE}[2/4] Setting up Frontend (React)...${NC}"
cd ../sceap-frontend
echo "Installing dependencies..."
npm install
echo -e "${GREEN}✓ Frontend ready!${NC}"
echo ""

# Summary
echo -e "${BLUE}[3/4] Workspace Structure${NC}"
cd ..
echo "Backend path: $(pwd)/sceap-backend"
echo "Frontend path: $(pwd)/sceap-frontend"
echo ""

# Instructions
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "To start development:"
echo ""
echo -e "${YELLOW}Terminal 1 - Backend:${NC}"
echo "  cd sceap-backend"
echo "  dotnet run --launch-profile https"
echo ""
echo -e "${YELLOW}Terminal 2 - Frontend:${NC}"
echo "  cd sceap-frontend"
echo "  npm run dev"
echo ""
echo "Then open: ${BLUE}http://localhost:3000${NC}"
echo "API Docs:  ${BLUE}https://localhost:5001/swagger${NC}"
echo ""
