import path from 'node:path'

const backupDir = process.env.D1_BACKUP_DIR || path.join('out', 'd1-backups')
const dbName = process.env.D1_DATABASE || 'ob-ai-api-dev'

console.log('D1 Disaster Recovery Drill (Guide)')
console.log('----------------------------------')
console.log('Backup directory:', backupDir)
console.log('Database name:', dbName)
console.log('')
console.log('1) Backup (Export)')
console.log(`npx wrangler d1 export ${dbName} --output ${backupDir}/backup.sql`)
console.log('')
console.log('2) Restore (Import to new DB)')
console.log('npx wrangler d1 create ob-ai-api-restore')
console.log(`npx wrangler d1 import ob-ai-api-restore --file ${backupDir}/backup.sql`)
console.log('')
console.log('3) Verify counts')
console.log('npx wrangler d1 execute ob-ai-api-restore --command "SELECT COUNT(*) FROM jobs"')
console.log('npx wrangler d1 execute ob-ai-api-restore --command "SELECT COUNT(*) FROM webhook_events"')
console.log('npx wrangler d1 execute ob-ai-api-restore --command "SELECT COUNT(*) FROM job_metrics"')
console.log('')
console.log('4) Update wrangler.toml if switching DB (manual)')
