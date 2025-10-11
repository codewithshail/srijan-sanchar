#!/usr/bin/env tsx

/**
 * Start background job workers
 * Run this script to process jobs from the queue
 * 
 * Usage: npm run workers
 */

import '../lib/jobs/worker';

console.log('Job workers started successfully!');
console.log('Press Ctrl+C to stop workers');
