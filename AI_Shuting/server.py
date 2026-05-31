import http.server
import json
import math

class AIDirector:
    def __init__(self):
        self.difficulty = 1.0  # Base difficulty factor
        self.min_diff = 0.5
        self.max_diff = 3.0
        self.learning_rate = 0.05

    def adjust(self, stats):
        """
        Adjusts difficulty based on player telemetry.
        Expected stats: {acc: float, health: int, killed: int, escaped: int, time: float}
        """
        acc = stats.get('acc', 0.5)
        health = stats.get('health', 100)
        killed = stats.get('killed', 0)
        escaped = stats.get('escaped', 0)
        
        # Calculate a Stress/Success metric
        # High accuracy and high kill count means player is skilled.
        # Low health and high escapes means player is struggling.
        
        success_factor = (acc * 0.4) + (min(killed / 10, 1.0) * 0.4)
        failure_factor = ((100 - health) / 100 * 0.5) + (min(escaped / 5, 1.0) * 0.5)
        
        performance = success_factor - failure_factor
        
        # If performance is high (e.g. > 0.2), increase difficulty
        if performance > 0.2:
            self.difficulty += self.learning_rate
        # If performance is low (e.g. < -0.1), decrease difficulty
        elif performance < -0.1:
            self.difficulty -= self.learning_rate * 2  # Ease up faster than tightening
            
        self.difficulty = max(self.min_diff, min(self.max_diff, self.difficulty))
        
        return {
            "difficulty": round(self.difficulty, 2),
            "spawn_rate_mult": round(self.difficulty, 2),
            "speed_mult": round(0.8 + (self.difficulty * 0.2), 2),
            "message": self._get_status_message(performance)
        }

    def _get_status_message(self, performance):
        if performance > 0.5: return "PLAYER DOMINATING - INCREASING INTENSITY"
        if performance > 0.2: return "STABLE - INCREASING CHALLENGE"
        if performance < -0.3: return "PLAYER STRUGGLING - EASING UP"
        return "FLOW STATE MAINTAINED"

director = AIDirector()

class RequestHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/adjust':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            stats = json.loads(post_data.decode('utf-8'))
            
            result = director.adjust(stats)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    port = 8000
    server_address = ('', port)
    httpd = http.server.HTTPServer(server_address, RequestHandler)
    print(f"AI Director Server running on port {port}...")
    httpd.serve_forever()
