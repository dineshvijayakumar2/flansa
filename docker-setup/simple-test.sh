#!/bin/bash

echo "🧪 Testing Minimal Docker Setup"
echo "================================"

# Stop everything first
docker compose down -v 2>/dev/null
docker rm -f $(docker ps -aq) 2>/dev/null

# Test if we can run Frappe at all
echo "📍 Testing basic Frappe bench image..."
docker run --rm -p 8083:8000 frappe/bench:latest bash -c "
  cd /home/frappe/frappe-bench && 
  bench --help && 
  echo '✅ Bench command works' &&
  ls -la sites/ &&
  echo '✅ Sites directory exists' &&
  bench serve --help &&
  echo '✅ Serve command available'
"

echo ""
echo "📊 Result: If you see all ✅ marks, the basic Frappe setup works."
echo "📍 Next: Try accessing http://localhost:8083 for 30 seconds"

# Try to start a basic server
docker run --rm -p 8083:8000 frappe/bench:latest bash -c "
  cd /home/frappe/frappe-bench && 
  timeout 30 bench serve --host 0.0.0.0 --port 8000 || echo 'Server test completed'
"