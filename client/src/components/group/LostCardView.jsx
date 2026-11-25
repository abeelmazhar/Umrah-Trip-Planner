import QrCode from './QrCode';

/**
 * The lost-pilgrim card. Deliberately bilingual (Arabic + English side by side) whatever the UI
 * language, because the reader is Haram security, police or a taxi driver, not the pilgrim.
 */
function Row({ en, ar, children }) {
  if (!children) return null;
  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-x-3 border-b border-black/5 py-2 last:border-0">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {en} · <span lang="ar">{ar}</span>
        </p>
        <div className="font-semibold">{children}</div>
      </div>
    </div>
  );
}

const Phone = ({ number }) => (
  <a href={`tel:${number.replace(/[^\d+]/g, '')}`} dir="ltr" className="text-brand underline">
    {number}
  </a>
);

export default function LostCardView({ card, qrUrl }) {
  const meeting = card.meetingPoint;
  return (
    <article className="lost-card mx-auto max-w-md overflow-hidden rounded-2xl bg-white shadow-sm ring-2 ring-accent print:shadow-none">
      <header className="islamic-pattern bg-brand px-5 py-4 text-center text-white">
        <p lang="ar" dir="rtl" className="font-arabic text-2xl font-bold">أنا تائه — أرجو مساعدتي</p>
        <p className="text-sm text-white/90">I am lost — please help me contact my group</p>
      </header>

      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto]">
        <div>
          <Row en="Name" ar="الاسم">{card.name}</Row>
          <Row en="Group" ar="المجموعة">{card.groupName}</Row>
          <Row en="Group leader" ar="قائد المجموعة">
            {card.leader?.name}
            {card.leader?.phone && (
              <>
                {' '}
                · <Phone number={card.leader.phone} />
              </>
            )}
          </Row>
          {card.phone && (
            <Row en="My phone" ar="هاتفي">
              <Phone number={card.phone} />
            </Row>
          )}
          {card.hotel && (
            <Row en="My hotel" ar="فندقي">
              <span lang="ar" dir="rtl" className="block font-arabic">{card.hotel.nameAr}</span>
              {card.hotel.addressAr && <span lang="ar" dir="rtl" className="block font-arabic text-sm font-normal">{card.hotel.addressAr}</span>}
              <span className="block text-sm font-normal">{card.hotel.name}</span>
            </Row>
          )}
          {meeting && (
            <Row en="Meeting point" ar="نقطة التجمع">
              {meeting.place}
              <span className="block text-sm font-normal">{meeting.title}</span>
            </Row>
          )}
        </div>
        {qrUrl && (
          <div className="flex flex-col items-center justify-start gap-1">
            <QrCode value={qrUrl} size={128} label="Lost card QR code" />
            <p className="text-center text-[10px] text-ink-muted">
              Scan · <span lang="ar">امسح</span>
            </p>
          </div>
        )}
      </div>

      <footer className="bg-accent-light px-5 py-2 text-center text-xs">
        <span lang="ar" dir="rtl">الطوارئ في السعودية</span> · <span dir="ltr">Emergency in Saudi Arabia: <b>911</b></span>
      </footer>
    </article>
  );
}
