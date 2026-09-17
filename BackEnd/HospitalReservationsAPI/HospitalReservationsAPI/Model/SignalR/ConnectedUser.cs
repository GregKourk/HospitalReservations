namespace HospitalReservationsAPI.Model.SignalR
{
    public class ConnectedUser
    {
        public string ConnectionId { get; set; }
        public int UserId { get; set; }
        public int TopLevelUnitId { get; set; }
        public List<string> AllRightsDesc { get; set; }
    }

    public static class UserConnectionManager
    {
        private static readonly List<ConnectedUser> ConnectedUsers = new List<ConnectedUser>();
        public static void AddUser(ConnectedUser user)
        {
            lock (ConnectedUsers)
            {
                ConnectedUsers.Add(user);
            }
        }
        public static void RemoveUser(string connectionId)
        {
            lock (ConnectedUsers)
            {
                ConnectedUsers.RemoveAll(u => u.ConnectionId == connectionId);
            }
        }
        public static ConnectedUser GetUser(string connectionId)
        {
            lock (ConnectedUsers)
            {
                return ConnectedUsers.FirstOrDefault(u => u.ConnectionId == connectionId);
            }
        }
        public static List<ConnectedUser> GetAllUsers()
        {
            lock (ConnectedUsers)
            {
                return new List<ConnectedUser>(ConnectedUsers);
            }
        }
    }
}
