import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runDailyGameMaintenance } from '../services/maintenance.js';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const run = async () => {
  const args = process.argv.slice(2);
  let targetDate: Date | undefined;

  if (args.length > 0) {
    const dateStr = args[0];
    // Append T12:00:00 to ensure we don't get timezone shifts when parsing YYYY-MM-DD
    // This makes it effectively "Noon" on that day in local/UTC, 
    // which serves our purpose of targetting that specific calendar day.
    targetDate = new Date(dateStr + 'T12:00:00');

    if (isNaN(targetDate.getTime())) {
      console.error('Invalid date format. Please use YYYY-MM-DD');
      process.exit(1);
    }
    console.log(`Manual maintenance requested for: ${dateStr}`);
  } else {
    console.log('No date provided, defaulting to "today" (Eastern Time)');
  }

  try {
    await runDailyGameMaintenance(targetDate);
    console.log('Manual maintenance completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error running maintenance:', error);
    process.exit(1);
  }
};

run();
