// THE ACCUMULATIVE ACCOUNTING ENGINE
export async function finalizeTradeCycle(blockId: number, selectedROIs: number[]) {
    // 1. Calculate the actual yield based on the Predetermined ROI of the 10 Portals
    // selectedROIs is an array of the 10 percentages the user picked (e.g., [0.65, 0.80, 0.50...])
    
    const fetchBlock = await pool.query(`SELECT * FROM asset_ledger WHERE block_id = $1`, [blockId]);
    const currentPrincipal = parseFloat(block.rows[0].current_block_value);
    
    // Calculate the total yield for this specific 10-song block
    const totalROI = selectedROIs.reduce((a, b) => a + b, 0) / 10; 
    const cycleProfit = currentPrincipal * totalROI;
    const newAccumulatedValue = currentPrincipal + cycleProfit;

    // 2. Log the Results (No Payout yet, just Accounting)
    const updateQuery = `
        UPDATE asset_ledger 
        SET current_block_value = $1, 
            trades_completed = trades_completed + 1,
            last_broadcast_sync = NOW()
        WHERE block_id = $2
        RETURNING trades_completed;
    `;
    
    const result = await pool.query(updateQuery, [newAccumulatedValue, blockId]);
    const cyclesDone = result.rows[0].trades_completed;

    // 3. Check for the 10th Cycle Settlement
    if (cyclesDone >= 10) {
        await pool.query(`UPDATE asset_ledger SET exit_status = 'SETTLED' WHERE block_id = $1`, [blockId]);
        return { status: "FINAL_SETTLEMENT", value: newAccumulatedValue };
    }

    return { status: "CYCLE_COMPLETE", current_value: newAccumulatedValue, next_cycle: cyclesDone + 1 };
}
