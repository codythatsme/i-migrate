export const RESTRICTED_DESTINATION_PROPERTIES: Record<string, string> = {
  Ordinal: 'Auto incrementing row ID for multi instance data sources',
  UpdatedOn: 'Unable to be overwritten, will be set as the date/time that the row is inserted',
  UpdatedBy: 'Username of the account that inserted the row (the username of the account logged in to i-migrate)',
  UpdatedByUserKey: 'Contact key of the account that inserted the row',
}

