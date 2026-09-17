using System.ComponentModel.DataAnnotations;

namespace HospitalReservationsAPI.Model.Extensions
{
    public static class EnumExtention
    {
        public static string DisplayName(this Enum value)
        {
            var type = value.GetType();
            string name = Enum.GetName(type, value);
            if (name == null)
            {
                return null;
            }
            var fieldInfo = type.GetField(name);
            var displayAttribute = fieldInfo?.GetCustomAttributes(typeof(DisplayAttribute), false)
                .FirstOrDefault() as DisplayAttribute;
            return displayAttribute?.Name ?? name;  
        }
    }
}
