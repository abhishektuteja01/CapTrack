import { describe, it, expect } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { parseFoBhavcopy, unzipFirst, weekdays } from '../nse'

const CSV = `TradDt,BizDt,Sgmt,Src,FinInstrmTp,FinInstrmId,ISIN,TckrSymb,SctySrs,XpryDt,FininstrmActlXpryDt,StrkPric,OptnTp,FinInstrmNm,OpnPric,HghPric,LwPric,ClsPric,LastPric,PrvsClsgPric,UndrlygPric,SttlmPric,OpnIntrst,ChngInOpnIntrst,TtlTradgVol,TtlTrfVal,TtlNbOfTxsExctd,SsnId,NewBrdLotQty,Rmks,Rsvd1,Rsvd2,Rsvd3,Rsvd4
2026-10-14,2026-10-14,FO,NSE,IDF,1,,NIFTY,,2026-10-27,2026-10-27,,,NIFTY26OCTFUT,0,0,0,22648.50,0,0,22622.70,22648.50,0,0,0,0,0,F1,65,,,,,
2026-10-14,2026-10-14,FO,NSE,IDO,2,,NIFTY,,2026-10-19,2026-10-19,20550.00,PE,NIFTY26O1920550PE,0,0,0,1.45,0,0,22622.70,1.40,0,0,0,0,0,F1,65,,,,,
2026-10-14,2026-10-14,FO,NSE,IDO,3,,NIFTY,,2026-10-14,2026-10-14,22500.00,CE,NIFTY26O1422500CE,0,0,0,215.85,0,0,22721.95,22721.95,0,0,0,0,0,F1,65,,,,,
2026-10-14,2026-10-14,FO,NSE,IDO,4,,NIFTY,,2026-10-14,2026-10-14,22500.00,PE,NIFTY26O1422500PE,0,0,0,0.30,0,0,22721.95,22721.95,0,0,0,0,0,F1,65,,,,,
`

/** A one-file zip, as NSE serves it. */
function zip(name: string, body: Buffer) {
  const data = deflateRawSync(body)
  const n = Buffer.from(name)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(8, 8)
  local.writeUInt32LE(data.length, 18)
  local.writeUInt32LE(body.length, 22)
  local.writeUInt16LE(n.length, 26)
  const cd = Buffer.alloc(46)
  cd.writeUInt32LE(0x02014b50, 0)
  cd.writeUInt16LE(8, 10)
  cd.writeUInt32LE(data.length, 20)
  cd.writeUInt32LE(body.length, 24)
  cd.writeUInt16LE(n.length, 28)
  cd.writeUInt32LE(0, 42)
  const cdOffset = 30 + n.length + data.length
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(46 + n.length, 12)
  end.writeUInt32LE(cdOffset, 16)
  return Buffer.concat([local, n, data, cd, n, end])
}

describe('NSE bhavcopy', () => {
  it('unzips and parses contracts', () => {
    const rows = parseFoBhavcopy(unzipFirst(zip('fo.csv', Buffer.from(CSV))).toString('utf8'))
    expect(rows.get('NIFTY26OCTFUT')).toMatchObject({ kind: 'future', expiry: '2026-10-27', close: 22648.5, lotSize: 65, underlyingPrice: 22622.7 })
    expect(rows.get('NIFTY26O1920550PE')).toMatchObject({ kind: 'option', strike: 20550, optionType: 'PE', settle: 1.4 })
  })
  it('settles expiring options at intrinsic value, not the underlying price NSE lists', () => {
    const rows = parseFoBhavcopy(CSV)
    expect(rows.get('NIFTY26O1422500CE')?.settle).toBeCloseTo(221.95)
    expect(rows.get('NIFTY26O1422500PE')?.settle).toBe(0)
  })
  it('lists weekdays', () => {
    expect(weekdays('2026-10-16', '2026-10-19')).toEqual(['2026-10-16', '2026-10-19'])
  })
})
