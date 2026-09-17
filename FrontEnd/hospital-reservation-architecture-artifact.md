# Artifact: Τεχνική πρόταση αρχιτεκτονικής για σύστημα κρατήσεων ιατρειών μικρού νοσοκομείου

## 1. Συνοπτική περιγραφή

Το σύστημα σχεδιάζεται ως ασφαλές, παρακολουθήσιμο και λειτουργικά έτοιμο πλατφόρμα διαχείρισης κλινικών ραντεβού για μικρό νοσοκομείο ή ομάδα κλινικών. Αποστολή του είναι να επιτρέπει:

- κράτηση ραντεβού από ασθενείς,
- διαχείριση κλινικών, γιατρών και τμημάτων,
- οργάνωση ωραρίου, διαθεσιμότητας και προγραμματισμού,
- live ενημερώσεις μέσω SignalR,
- πλήρη λογοδοσία και audit trail,
- αυθεντικοποίηση μέσω Gov.gr OAuth/OIDC,
- ρητό και ασφαλές σύστημα ρόλων και δικαιωμάτων.

Το τελικό αποτέλεσμα πρέπει να είναι λειτουργικά σωστό, τεχνικά ασφαλές και πλήρως παρακολουθήσιμο.

---

## 2. Στόχος αρχιτεκτονικής

Η λύση θα πρέπει να επιτρέπει:

- ξεκάθαρη διαίρεση ρόλων (Admin, SuperUser, ClinicManager, Doctor, Reception, Patient),
- ασφαλή πρόσβαση στο σύστημα μέσω εξωτερικού IdP,
- καθορισμό business rules για να μην δημιουργούνται αδύναμες ή ασαφείς κρατήσεις,
- πλήρη καταγραφή κάθε κρίσιμης ενέργειας,
- σύνδεση frontend/backend/database σε δομημένα, ασφαλή και εύκολα διαχειρίσιμα στρώματα,
- live ενημερώσεις σε κλινικές, γιατρούς, reception και admins.

---

## 3. Προτεινόμενη τεχνολογική στοίβα

### Frontend
- React + TypeScript
- DevExtreme (Scheduler, DataGrid, Form, Popup, Validation)
- React Router
- Role-based route guards
- SignalR client

### Backend
- ASP.NET Core Web API (προτιμάται για το stack που ζητάς)
- ή Node.js/NestJS ως εναλλακτική
- JWT-based authorization μετά από Gov.gr login
- Business services για clinics, doctors, schedules και appointments
- Policy-based authorization

### Database
- SQL Server
- Entity Framework Core ή Dapper
- stored procedures για κρίσιμες λειτουργίες όπου χρειάζεται

### Realtime
- ASP.NET SignalR
- groups ανά clinic, doctor, department, patient, admin

### Security / Identity
- Gov.gr OAuth 2.0 / OIDC
- PKCE
- JWT for app internal API access
- refresh token rotation

### Operations / Monitoring
- Serilog
- OpenTelemetry
- Application Insights / ELK / Grafana
- secret manager

---

## 4. Αρχιτεκτονική σε 4 επίπεδα

### 4.1 Presentation Layer

- React UI με role-aware navigation
- DevExtreme components για workflow scheduling και list views
- admin dashboard
- doctor calendar
- reception desk workflow
- patient appointment booking and status tracking

### 4.2 Application Layer

- API endpoints για:
  - authentication
  - users
  - roles
  - clinics
  - doctors
  - departments
  - schedules
  - appointments
  - notifications
  - audit
- business services με validation rules
- role-based checks before executing critical logic

### 4.3 Data Layer

- SQL Server schema
- repositories / data access layer
- transactional writes
- data consistency checks
- audit tables

### 4.4 Security / Identity Layer

- Gov.gr as identity provider
- local mapping of external claims to internal roles
- permission checks on every protected action
- centralized API authorization logic
- audit and monitoring for security events

---

## 5. Ρόλοι και δικαιώματα

| Ρόλος | Κύρια δικαιώματα |
| --- | --- |
| Admin | πλήρη διαχείριση συστήματος, χρήστες, ρόλοι, κλινικές, logs, security settings |
| SuperUser | επιχειρησιακή διαχείριση, έκτακτες καταστάσεις, ορατότητα σε κρίσιμα logs και workflows |
| ClinicManager | δημιουργία/διαχείριση κλινικής, τμημάτων, γιατρών, ωραρίου, appointments |
| Doctor | προβολή ωραρίου, επιβεβαίωση/ακύρωση ραντεβού,medical notes όπου επιτρέπεται |
| Reception / FrontDesk | κράτηση, ακύρωση, check-in, queue, reminders |
| Patient | προβολή profile, κράτηση με βάση διαθέσιμα slots, δραστηριότητα ραντεβού |

### Κανόνας ασφαλείας
- default deny για κρίσιμες λειτουργίες,
- role check σε API,
- role and clinic scope check σε UI,
- authorization βάσει κάτοχου δεδομένων (patient ownership, clinic ownership, doctor ownership).

---

## 6. Gov.gr OAuth / OIDC ροή

### Στόχος
Η εφαρμογή θα χρησιμοποιεί το Gov.gr ως κεντρικό identity provider και θα δημιουργεί το δικό της εσωτερικό security model για τα business permissions.

### Βήματα υλοποίησης

1. Δημιουργία application client στο Gov.gr
2. Ρύθμιση redirect URIs και logout URIs
3. Ενεργοποίηση OIDC και PKCE
4. Ανάκτηση ID token και access token
5. Επαλήθευση issuer, audience, signature, nonce/PKCE
6. Mapping claims σε εσωτερικούς ρόλους
7. Δημιουργία ή ενημέρωση user record στο app
8. Δημιουργία app JWT για επικοινωνία με το backend
9. Ανάθεση Role + permissions στην πηγή του backend
10. Όλα τα protected endpoints ελέγχονται με JWT και RBAC

### Απαιτούμενα security controls
- Authorization Code + PKCE
- short-lived access tokens
- refresh token rotation
- secure token storage
- strict redirect validation
- IP + user-agent logging
- MFA για high-risk roles
- rate limiting σε auth endpoints

---

## 7. Προστασία ασφαλείας και δεδομένων

### 7.1 API security
- HTTPS only
- CORS allowlist
- secure headers
- rate limiting
- anti-bruteforce controls
- input validation and sanitization
- minimal privilege accounts

### 7.2 Data protection
- encryption in transit
- encryption at rest
- no secrets in repo
- secret manager
- minimum necessary personal data exposure
- masking/obfuscation για ευαίσθητα πεδία

### 7.3 Session security
- HttpOnly + Secure + SameSite cookies όπου απαιτούνται
- short session timeout
- absolute timeout
- refresh token rotation
- logoff invalidation

### 7.4 Compliance/observability
- log all auth attempts
- review security events
- alert on suspicious patterns
- maintain audit retention policy

---

## 8. Database μοντέλο

### Βασικές οντότητες
- Users
- Roles
- Permissions
- UserRoles
- Clinics
- Departments
- Doctors
- DoctorSchedules
- Specialties
- Patients
- Appointments
- AppointmentStatusHistory
- AuditLogs
- Notifications
- Settings

### Κύριες απαιτήσεις του schema
- normalized model
- foreign key integrity
- indexes σε doctorId, clinicId, patientId, status, appointmentDate
- datetimeoffset για timezone-safe timestamps
- constraint για να μην υπάρχει overlap για ίδιον γιατρό σε ίδια χρονική περίοδο
- separate audit tables
- soft delete σε κρίσιμα entities όπου χρειάζεται

### Example business rules
- ένα appointment πρέπει να έχει clinic, doctor και patient
- δεν μπορεί να υπάρχει overlap στον ίδιο doctor σε ίδιο time slot
- status transitions πρέπει να είναι valid
- κάθε update πρέπει να αφήνει ίχνος στο audit log

---

## 9. SignalR live notifications

### Σκοπός
Για live ενημερώσεις σε users και admins όταν αλλάζει η κατάσταση των κρατήσεων ή των κλινικών.

### Event examples
- AppointmentCreated
- AppointmentCancelled
- AppointmentConfirmed
- AppointmentRescheduled
- DoctorScheduleUpdated
- ClinicAlert
- ReminderSent

### Grouping
- clinic-{clinicId}
- doctor-{doctorId}
- department-{departmentId}
- patient-{patientId}
- admin-global

### Απαιτήσεις
- authorization ανά group
- δεν επιτρέπεται διαρροή σε λανθασμένους χρήστες
- logging κάθε event
- live UI updates χωρίς refresh

---

## 10. Audit trail

Πρέπει να καταγράφονται όλα τα κρίσιμα γεγονότα.

### Κατηγορίες event
- login/logout
- failed attempts
- role assignment changes
- clinic create/update/delete
- doctor create/update/delete
- schedule changes
- appointment changes
- reschedule/cancel/confirm
- admin actions
- report exports
- security events

### Πεδία κάθε event
- userId
- role
- action
- entityType
- entityId
- timestamp
- sourceIp
- userAgent
- beforeValue
- afterValue

### Σημείωση
Η καταγραφή πρέπει να είναι secure και να μπορεί να ελεγχθεί ως δευτερογενής αποδεικτικό στοιχείο σε audit ή incident review.

---

## 11. Μοντέλο workflow εφαρμογής

### 11.1 Patient workflow
1. Login μέσω Gov.gr
2. Εμφάνιση διαθέσιμων slots για επιλεγμένο clinic / doctor
3. Κράτηση ραντεβού
4. Ειδοποίηση μέσω SignalR
5. Προβολή status και ιστορικού

### 11.2 Reception workflow
1. Login με reception role
2. Αναζήτηση patient / clinic / doctor
3. Κράτηση / ακύρωση / μεταφορά ραντεβού
4. Check-in patient
5. Ενημέρωση ενημερωμένων boards

### 11.3 Doctor workflow
1. Login με doctor role
2. Προβολή ημερολογίου
3. Επιβεβαίωση ή απόρριψη ραντεβού
4. Αλλαγή διαθεσιμότητας
5. Ενημέρωση και ανατροφοδότηση στο σύστημα

### 11.4 Admin workflow
1. Διαχείριση χρηστών και ρόλων
2. Δημιουργία και διαχείριση κλινικών
3. Επαλήθευση logs και security events
4. Ανάλυση KPI και reports

---

## 12. API design proposal

### Authentication endpoints
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/refresh
- GET /api/auth/profile

### User endpoints
- GET /api/users
- POST /api/users
- PATCH /api/users/{id}
- DELETE /api/users/{id}

### Clinic endpoints
- GET /api/clinics
- POST /api/clinics
- PUT /api/clinics/{id}
- DELETE /api/clinics/{id}

### Doctor endpoints
- GET /api/doctors
- POST /api/doctors
- PUT /api/doctors/{id}
- GET /api/doctors/{id}/schedule

### Appointment endpoints
- GET /api/appointments
- POST /api/appointments
- PATCH /api/appointments/{id}/confirm
- PATCH /api/appointments/{id}/cancel
- PATCH /api/appointments/{id}/reschedule

### Audit endpoints
- GET /api/audit
- GET /api/audit/{entityType}/{entityId}
- GET /api/audit/export

---

## 13. Σχέδιο υλοποίησης

### Φάση 1: Foundation
- Gov.gr OIDC setup
- role model
- JWT flow
- protected API structure
- audit logging base

### Φάση 2: Core domain
- clinics, doctors, departments
- schedules and appointments
- validation and workflow rules

### Φάση 3: Operational workflows
- reception desk
- doctor calendar
- patient booking flow
- cancellation and reschedule logic

### Φάση 4: Realtime and monitoring
- SignalR integration
- dashboards
- alerts and monitoring
- audit review

### Φάση 5: Hardening and production readiness
- load/security review
- penetration testing approach
- backup/restore plan
- incident response playbook

---

## 14. Κρίσιμος κανόνας

Δεν αποδέχομαι ασαφή role policy, αδύναμο audit trail ή μη ασφαλείς auth flows.

Η λύση πρέπει να είναι:
- λειτουργικά σωστή,
- τεχνικά ασφαλής,
- πλήρως παρακολουθήσιμη,
- έτοιμη για production, χωρίς αδύναμες παραδοχές στη διαχείριση ρόλων ή στη διαφύλαξη δεδομένων.

---

## 15. Συμπέρασμα

Το τελικό σύστημα πρέπει να αντιμετωπίζεται ως κριτικά ασφαλής, κλινικά λειτουργικός και πλήρως παρακολουθήσιμο application. Η σωστή αρχιτεκτονική είναι εκείνη που ενσωματώνει με σαφήνεια:

- Gov.gr OIDC για ταυτότητα,
- RBAC / ABAC για δικαιώματα,
- SQL Server για διαχείριση δεδομένων,
- SignalR για live notifications,
- audit trail για κάθε κρίσιμη συναλλαγή,
- React + DevExtreme για UX και scheduling workflows.

Αυτό το μοντέλο παρέχει ισχυρότητα, ασφάλεια, ευελιξία και εξέλιξη χωρίς να θυσιάζεται η λειτουργικότητα του νοσοκομειακού συστήματος.
