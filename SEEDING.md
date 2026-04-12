# Smart Campus Backend - Automatic Database Seeding System

## Overview

This system automatically populates your database with demo data when the backend starts, if enabled via environment variables. It's production-safe and designed for easy deployment.

## Key Features

- **Automatic seeding**: Runs on server startup when enabled
- **Production-safe**: Does NOT run in production unless explicitly forced (and even then, it's blocked by default)
- **Reset capability**: Option to clear existing demo data before seeding
- **Realistic demo data**: 5 schools with complete data including users, classes, subjects, etc.
- **Password hashing**: Uses bcrypt with 12 rounds
- **Duplicate prevention**: Won't create duplicate data if already seeded

## Environment Variables

### Required for Seeding
```env
AUTO_SEED_TEST_DATA=true      # Enable automatic seeding on startup
AUTO_SEED_RESET_DATA=false    # Clear existing demo data before seeding (optional)
SEED_TEST_PASSWORD=123456     # Default password for all demo users
```

### Production Safety
```env
FORCE_SEED_IN_PRODUCTION=false # Set to true to allow seeding in production (NOT RECOMMENDED)
```

## How It Works

1. **Server starts** - When you run `npm start` or `node index.js`
2. **Checks environment** - Verifies `AUTO_SEED_TEST_DATA=true`
3. **Validates environment** - Won't run in production unless forced
4. **Checks existing data** - Only seeds if no existing demo data (unless reset is enabled)
5. **Creates demo data** - Generates 5 complete schools with all associated data
6. **Logs results** - Shows counts of created items

## Demo Data Structure

For each of the 5 schools:

### Schools (5 total)
- Name: "Smart School 1", "Smart School 2", etc.
- Unique schoolCode: SC01, SC02, etc.
- Active status: true

### Users (60 total per school = 300 total)
- **Principals (5)**: 1 per school
- **Teachers (25)**: 5 per school, each assigned to different subjects
- **Students (250)**: 50 per school (5 classes × 2 sections × 5 students = 50, but actually 10 students per class × 5 classes = 50)
- **Parents (125)**: 2-3 students per parent (approx)

### Classes & Sections
- Classes: 6, 7, 8, 9, 10
- Sections: A, B for each class
- Each class has a class teacher

### Subjects (7 total, assigned per class)
- Bangla, English, Mathematics, Science, ICT, Social Science, Religion
- Each subject assigned to a teacher for each class level

### Relationships
- Proper MongoDB ObjectId references between all models
- Users linked to schools
- Students linked to parents and classes
- Teachers assigned to subjects and classes

## How to Use

### 1. Development Setup

Create a `.env` file in your project root:

```env
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/smart-campus
AUTO_SEED_TEST_DATA=true
AUTO_SEED_RESET_DATA=false
SEED_TEST_PASSWORD=123456
```

### 2. Start the Server

```bash
npm start
# or
node index.js
```

### 3. Monitor Seeding

You'll see output like:
```
🔐 Hashing password...
🏫 Creating demo schools and data...
   Creating school 1/5...
✅ Seed completed in 2450ms
   Schools: 5
   Users: 1500
   Students: 250
   Teachers: 25
   Subjects: 175
```

### 4. Test the Data

Access the API endpoints:
- `GET /api/health` - Check server status
- `GET /api/super-admin/schools` - See all seeded schools (requires super admin)
- `GET /api/auth/login` - Login with demo credentials

### 5. Default Credentials

All demo users share the same password from `SEED_TEST_PASSWORD`:
- Principals: principal.sc01_demo@test.com, principal.sc02_demo@test.com, etc.
- Teachers: ban.tch1.sc01_demo@test.com, eng.tch1.sc01_demo@test.com, etc.
- Students: std.sc01.6A.1_demo@test.com, std.sc01.6A.2_demo@test.com, etc.
- Parents: parent.sc01.g001_demo@test.com, etc.

## Production Deployment

### Safe Defaults
```env
NODE_ENV=production
AUTO_SEED_TEST_DATA=false    # NEVER seed in production by default
FORCE_SEED_IN_PRODUCTION=false
```

### To Enable Production Seeding (NOT RECOMMENDED)
```env
AUTO_SEED_TEST_DATA=true
FORCE_SEED_IN_PRODUCTION=true
```
**Warning**: This will create demo data in your production database, which could interfere with real users and data.

## Resetting Data

To reset demo data on next startup:
```env
AUTO_SEED_RESET_DATA=true
```

This will delete all existing data with the `auto-seed-v1` tag before creating new data.

## Technical Details

### File Structure
```
scripts/
  seed-data.js    # Main seeding module
```

### Key Functions
- `seedDatabase({ resetExisting })` - Main function that creates demo data
- `hasExistingSeedData()` - Checks if seeding has already been done
- `deleteExistingSeedData()` - Removes existing demo data
- `createSchool(index, hashedPassword)` - Creates one complete school

### Data Quality
- Realistic naming patterns using school codes
- Proper bcrypt password hashing
- Unique email addresses for all users
- Correct role assignments (principal, teacher, student, parent)
- Valid class enrollments with roll numbers
- Teacher assignments to subjects and classes

## Troubleshooting

### Seeding Skipped
If you see "Seed data already exists" but want to reset:
```env
AUTO_SEED_RESET_DATA=true
```

### Production Error
If seeding fails in production:
```env
# Check if you have FORCE_SEED_IN_PRODUCTION=true
# Remove that and restart if you don't want seeding in production
```

### Connection Issues
Ensure MongoDB is running and `MONGO_URI` is correct.

## Security Considerations

- **Never enable AUTO_SEED_TEST_DATA in production** unless you know what you're doing
- **Change SEED_TEST_PASSWORD** from default "123456" for better security
- **Use FORCE_SEED_IN_PRODUCTION with extreme caution** - this will write demo data to your production database
- All demo users have the same password, so consider changing it after seeding if the system will be accessible to others

## Testing the Seeding

To test the seeding manually:
```bash
# Clear database and seed
node -e "require('./scripts/seed-data').seedDatabase({resetExisting: true})"

# Just check if seeding would run
node -e "require('./scripts/seed-data').seedDatabase()"
```

## Integration with Deployment

For continuous deployment (like Render, Heroku, etc.):
1. Set environment variables in your hosting dashboard
2. Ensure `AUTO_SEED_TEST_DATA=false` for production
3. For staging environments, you can enable it with `NODE_ENV=staging`

## Customization

To customize the demo data:
1. Edit `scripts/seed-data.js`
2. Modify the constants at the top (SUBJECTS, CLASS_LEVELS, etc.)
3. Adjust the number of schools or students per class
4. Restart the server with `AUTO_SEED_RESET_DATA=true` to apply changes

## Performance

Seeding 5 schools with complete data takes approximately 2-5 seconds depending on your hardware and database speed. The process is asynchronous and won't block other startup operations.

## Rollback

If you accidentally seed production data:
1. Stop the server
2. Connect to MongoDB: `mongosh "your-connection-string"`
3. Delete seeded data: `db.schools.deleteMany({ seedTag: 'auto-seed-v1' })`
4. Restart server without seeding flags

## Future Enhancements

This system can be extended to:
- Support multiple languages
- Include more realistic data (grades, attendance history)
- Add file attachments (student photos, documents)
- Generate more complex relationships (siblings, teacher history)
- Export/import seeding configurations