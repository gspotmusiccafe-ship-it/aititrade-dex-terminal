import { getSheetData } from './sheets-logger'; // This links to your Drizzell/Global Index

export async function finalizeTradeCycle(blockId: number, songIds: string[]) {
    // 1. Fetch the Live ROI from your Google Sheet Index
    const globalIndex = await getSheetData(process.env.SPREADSHEET_ID);
    
    // 2. Match the played songs to their Sheet Rows to get the Real ROI
    const selectedSongs = globalIndex.filter(row => songIds.includes(row.id));
    const totalROI = selectedSongs.reduce((sum, song) => sum + parseFloat(song.roi), 0) / 10;

    // 3. Update the Neon Ledger with the Accumulative Total
    const fetchBlock = await pool.query(`SELECT * FROM asset_ledger WHERE block_id = $1`, [blockId]);
    const currentPrincipal = parseFloat(fetchBlock.rows[0].current_block_value);
    const newAccumulatedValue = currentPrincipal * (1 + (totalROI / 100));

    await pool.query(`
        UPDATE asset_ledger 
        SET current_block_value = $1, trades_completed = trades_completed + 1 
        WHERE block_id = $2
    `, [newAccumulatedValue, blockId]);

    return { status: "SUCCESS", newValue: newAccumulatedValue };
}
