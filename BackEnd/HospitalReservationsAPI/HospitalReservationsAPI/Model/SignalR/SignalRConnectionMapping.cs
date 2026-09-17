namespace HospitalReservationsAPI.Model.SignalR
{
    public class SignalRConnectionMapping 
    {
        private readonly Dictionary<string, HashSet<string>> _connections = new Dictionary<string, HashSet<string>>();
        public void AddConnection(string userId, string connectionId)
        {
            lock (_connections)
            {
                if (!_connections.ContainsKey(userId))
                {
                    _connections[userId] = new HashSet<string>();
                }
                _connections[userId].Add(connectionId);
            }
        }
        public void RemoveConnection(string userId, string connectionId)
        {
            lock (_connections)
            {
                if (_connections.ContainsKey(userId))
                {
                    _connections[userId].Remove(connectionId);
                    if (_connections[userId].Count == 0)
                    {
                        _connections.Remove(userId);
                    }
                }
            }
        }
        public IEnumerable<string> GetConnections(string userId)
        {
            lock (_connections)
            {
                if (_connections.ContainsKey(userId))
                {
                    return _connections[userId];
                }
                return Enumerable.Empty<string>();
            }
        }

        public Dictionary<string, HashSet<string>> GetAllConnections()
        {
            lock (_connections)
            {
                return new Dictionary<string, HashSet<string>>(_connections);
            }
        }
    }
}
