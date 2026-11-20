from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor

OUT = 'output/GroupNumber_Implementation-Issues.pdf'
pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Bold', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Italic', 'C:/Windows/Fonts/ariali.ttf'))

navy = HexColor('#17324D')
blue = HexColor('#246B8E')
light = HexColor('#EAF2F6')
muted = HexColor('#5B6870')
orange = HexColor('#FFF2D9')
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleX', fontName='Arial-Bold', fontSize=19, leading=23, textColor=colors.black, spaceAfter=8, alignment=TA_CENTER))
styles.add(ParagraphStyle(name='SubX', fontName='Arial', fontSize=12, leading=16, textColor=colors.black, spaceAfter=14, alignment=TA_CENTER))
styles.add(ParagraphStyle(name='H1X', fontName='Arial-Bold', fontSize=14, leading=18, textColor=colors.black, spaceBefore=11, spaceAfter=7, keepWithNext=True))
styles.add(ParagraphStyle(name='H2X', fontName='Arial-Bold', fontSize=12, leading=15, textColor=colors.black, spaceBefore=8, spaceAfter=4, keepWithNext=True))
styles.add(ParagraphStyle(name='BodyX', fontName='Arial', fontSize=10, leading=13, spaceAfter=6))
styles.add(ParagraphStyle(name='SmallX', fontName='Arial', fontSize=8.5, leading=11))
styles.add(ParagraphStyle(name='CellX', fontName='Arial', fontSize=8.3, leading=10.5))
styles.add(ParagraphStyle(name='CellHeadX', fontName='Arial-Bold', fontSize=8.3, leading=10.5, textColor=colors.white))
styles.add(ParagraphStyle(name='CalloutX', fontName='Arial-Bold', fontSize=9.5, leading=13, textColor=colors.black, backColor=HexColor('#EEEEEE'), borderPadding=8, spaceBefore=6, spaceAfter=10))

P = lambda text, style='BodyX': Paragraph(text, styles[style])
def cell(text, head=False): return Paragraph(text, styles['CellHeadX' if head else 'CellX'])
def make_table(data, widths, header=True, font=7.4):
    t=Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign='LEFT')
    cmds=[('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),0.35,HexColor('#B9C8D1')),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]
    if header: cmds += [('BACKGROUND',(0,0),(-1,0),navy),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,HexColor('#F5F8FA')])]
    t.setStyle(TableStyle(cmds)); return t

doc=SimpleDocTemplate(OUT,pagesize=A4,rightMargin=.7*inch,leftMargin=.7*inch,topMargin=.65*inch,bottomMargin=.7*inch,title='MediFind Implementation Issues and Retesting Report',author='MediFind Project Group')
story=[]
story += [P('MediFind Implementation Issues and Retesting Report','TitleX'),P('IT314 Software Testing  |  Group assignment  |  Evidence-based draft for group completion','SubX')]
story += [P('1. Project Information','H1X')]
info=[[cell('Project / system',True),cell('Group number',True),cell('Section',True)],[cell('MediFind — Online Medicine Search and Ordering System'),cell('Group 5'),cell('[Enter section]')]]
story += [make_table(info,[3.4*inch,1.5*inch,1.8*inch]),Spacer(1,8),P('<b>Group members</b>','H2X')]
members=[[cell('Name',True),cell('Position',True),cell('Assigned task',True),cell('Actual contribution and evidence',True)]]
roles=[
('Amba, Denver','Group Leader','Lead the testing effort, coordinate issue retests, consolidate evidence, and prepare the group submission.'),
('Anches, James Reuben','Backend Testing Lead','Test API, account, order, and pharmacy workflows; record reproducible results.'),
('Bacason, Fritz Gian','Frontend Testing Lead','Test customer search, cart, checkout, and navigation in the running app.'),
('Cabingas, Lourens Khent','Prescription and Security Tester','Test prescription upload/review and customer data access controls.'),
('Llagas, Carl James','Device and Evidence Coordinator','Run available phone/device checks and collect labeled screenshots/logs.'),
]
for name,role,task in roles: members.append([cell(name),cell(role),cell(task),cell('[Complete with actual work performed and evidence]')])
story += [make_table(members,[1.18*inch,1.22*inch,1.62*inch,2.68*inch]),Spacer(1,8),P('This draft documents five historical implementation issues from the repository source and workflow review dated October 21, 2026. The review records reproducible behavior, source locations, implemented fixes, and validation. The current checkout contains those fixes. The original failed runs were isolated reproductions in disposable test databases, not screenshots from a live group run. Add original screenshots if available, verify report details with the group, and replace bracketed contribution and section fields before submission.','CalloutX')]
story += [P('2. Implementation Issues Report','H1X'),P('The following five findings are taken from the recorded October 21 review. Each was reproduced during that review, fixed locally, and included in the remediation validation. They are historical issues, not claims that the current checkout still fails.','BodyX')]
issues=[
('ISS-01','Account switch exposed the previous account’s cart and checkout recipient/address draft. <b>Where:</b> cart/checkout providers in frontend. <b>Reproduce (Oct 21 review):</b> account A adds cart items and enters recipient/address; sign out, sign in as B in the same app instance; B can see A’s private draft.','Providers remained mounted outside the profile provider and did not reset state on account changes. The audit also noted late order refresh responses could commit across accounts.','Providers were scoped to account/session generation and late API responses rejected. Current code includes generation guards in shared order state and private providers.','Resolved in reviewed checkout; remediation review reports 59 frontend and 24 backend tests passed.','Resolved'),
('ISS-02','Reusing a checkout submission key could return a prior order with a different cart. <b>Where:</b> frontend checkout and backend order service. <b>Reproduce:</b> submit quantity 1, then quantity 7 using the same key; isolated reproduction returned the original quantity-1 order.','The UI used React useId as an idempotency key; backend treated repeated keys as the same attempt without verifying changed order contents.','Generate a UUID per checkout attempt and reject key reuse with different order contents. Current checkout uses Crypto.randomUUID; backend validates replayed keys.','Resolved in reviewed checkout; repeated-key replay is covered by remediation tests.','Resolved'),
('ISS-03','Cart and approved prescription details could crash when a live medicine/offer disappeared or prescription data loaded before catalog data. <b>Where:</b> cart and prescription detail screens. <b>Reproduce:</b> remove/replace the referenced live catalog record or restore prescription data before catalog load; screens dereferenced missing records.','Render code assumed medicine and offer lookups always returned a record.','Added unavailable/loading handling, retained snapshots, and safe record access. Current cart uses guarded lookups and stored medicine snapshots.','Resolved in reviewed checkout; remediation validation reported all 59 frontend tests passing.','Resolved'),
('ISS-04','Legacy staff dispatch could assign a rider before pharmacy acceptance and stock reservation. <b>Where:</b> Django customer-data admin dispatch. <b>Reproduce (isolated DB):</b> dispatch an awaiting-confirmation order with no reservation; audit recorded rider assignment returning HTTP 302.','Admin dispatch checked recipient/address and readiness input but did not enforce managed-order state or use pharmacy handoff service.','Dispatch now filters for ready-for-collection delivery orders with held reservations and uses the shared dispatch workflow.','Resolved in reviewed checkout; readiness and reservation checks covered by backend remediation validation.','Resolved'),
('ISS-05','Admin rider status updates could leave the customer order confirmed and stock reserved after delivery completion. <b>Where:</b> Django rider admin actions. <b>Reproduce (isolated DB):</b> mark rider delivery delivered via admin; audit observed delivery delivered while customer order remained confirmed and one unit remained reserved.','Admin save/retry/return actions bypassed rider_updated synchronization service used by the API.','Admin changes now use shared validated delivery transitions that synchronize customer order status and inventory reservation.','Resolved in reviewed checkout; backend suite and delivery/stock synchronization cases passed per remediation review.','Resolved'),
]
data=[[cell('Issue ID',True),cell('Description / where it occurred',True),cell('Possible cause',True),cell('Solution applied and retest',True),cell('Status',True)]]
for row in issues: data.append([cell(row[0]),cell(row[1]),cell(row[2]),cell(row[3]+'<br/><b>Retest:</b> '+row[4]),cell(row[5]+'<br/>historical')])
story += [KeepTogether([make_table(data,[.52*inch,1.55*inch,1.42*inch,1.7*inch,1.03*inch]),Spacer(1,5),P('Historical issues and fixes are documented in docs/SCREEN_CONFLICT_REVIEW.md. Its reproductions used disposable test databases, not saved user accounts or orders.','SmallX')])]
story += [P('3. Evidence of Issues and Fixes','H1X'),P('The October 21 source review provides source locations, reproduction descriptions, and isolated API reproduction results, but the repository does not contain screenshots of original errors and post-fix behavior. Do not substitute design-reference screenshots for defect evidence. Add genuine screenshots or test logs if retained. Relevant source locations: account state: frontend/src/state/cart.tsx and checkout.tsx; checkout key: frontend/src/app/checkout.tsx and backend/pharmacies/services.py; missing catalog data: frontend/src/app/cart.tsx and frontend/src/app/prescriptions/[id].tsx; dispatch: backend/customer_data/admin.py and backend/pharmacies/services.py; rider synchronization: backend/riders/admin.py and backend/pharmacies/services.py. Redact customer information, credentials, tokens, and private prescription content.','BodyX')]
evidence=[[cell('Issue ID',True),cell('Original error or unexpected behavior',True),cell('Relevant source/configuration',True),cell('Corrected behavior after fix',True)]]
for i in range(1,6): evidence.append([cell(f'ISS-{i:02d}'),cell('[Attach original isolated reproduction log/screenshot if retained; review describes steps and result.]'),cell('See source paths above and review report.'),cell('Current code contains documented fix; attach fresh group screenshot/log if required.')])
story += [make_table(evidence,[.55*inch,2.05*inch,2.05*inch,2.05*inch]),Spacer(1,4),P('Fresh automated verification for this report: frontend npm test and npm run typecheck were run on November 20, 2026; results are recorded below.','SmallX')]
story += [P('4. Retesting Results','H1X')]
tests=[[cell('Feature tested',True),cell('Test performed',True),cell('Expected result',True),cell('Actual result',True),cell('Status',True)]]
for row in [
('Frontend behavior suite','Ran <b>npm test</b> in frontend; 59 tests executed.','All automated frontend checks pass.','59 passed; 0 failed on November 20, 2026. Automated tests only.','Pass'),
('TypeScript','Ran <b>npm run typecheck</b> in frontend.','No TypeScript diagnostics.','Command completed successfully on November 20, 2026.','Pass'),
('Historical remediation suite','Review states 24 backend tests passed after remediation.','Account scoping, replay protection, dispatch readiness, and delivery/stock synchronization remain correct.','Historical review recorded 24/24 backend and 59/59 frontend tests passed. Fresh backend suite not run for this report.','Pass (historical)'),
]: tests.append([cell(x) for x in row])
story += [make_table(tests,[1.15*inch,1.4*inch,1.5*inch,1.85*inch,.85*inch]),Spacer(1,5),P('Automated results do not establish that the complete app, live data, external services, or mobile-device workflows pass.','SmallX')]
story += [P('5. Member Contributions','H1X'),P('The names are from the Group 5 MediFind masterfile. Role assignments are proposed and not evidence of work performed. Replace placeholders with each member actual issue, test, and screenshot contribution.','BodyX')]
contrib=[[cell('Group member',True),cell('Assigned task',True),cell('Actual contribution / evidence',True)]]
for name,role,task in roles: contrib.append([cell(name+'<br/><b>'+role+'</b>'),cell(task),cell('[Record actual work, issue IDs, test runs, screenshots, or commits.]')])
story += [KeepTogether([make_table(contrib,[1.55*inch,2.35*inch,2.8*inch])])]
story += [P('6. Remaining Issues and Next Steps','H1X')]
for text in [
'<b>Evidence packaging:</b> attach screenshots or logs of original reproductions and corresponding fixed behavior if retained; the repository review does not include those captures.',
'<b>Current validation:</b> run the backend regression suite and relevant browser workflows against the group test setup; the audit’s 24 backend pass result is historical.',
'<b>Other checks:</b> complete outstanding live API, location-permission, and physical-device tests noted in the project validation notes.',
'<b>Group completion:</b> identify which roster member is the user and Group Leader, enter the class section, and record each person’s actual contribution. Attach genuine issue screenshots and retesting evidence.',
'<b>Submission:</b> save as GroupNumber_Implementation-Issues.pdf, add to the Master Project File, and have the group leader submit it.',
]: story.append(P('• '+text,'BodyX'))
story.append(Spacer(1,10))
story.append(PageBreak())
story.append(P('Source basis','H1X'))
story.append(P('MediFind repository README and backend API notes; docs/CUSTOMER_PREVIEW_VALIDATION.md (validation dated October 20, 2026); frontend automated test suite; and a fresh frontend test/typecheck run on November 20, 2026. The group must supply actual defect evidence and contributions; the class section remains to be entered.','SmallX'))

def footer(canvas, doc):
    canvas.saveState(); w,h=A4
    canvas.setStrokeColor(HexColor('#D5E0E6')); canvas.setLineWidth(.5); canvas.line(.58*inch,.43*inch,w-.58*inch,.43*inch)
    canvas.setFont('Arial',7.5); canvas.setFillColor(muted); canvas.drawString(.58*inch,.27*inch,'MediFind  |  IT314 Software Testing')
    canvas.drawRightString(w-.58*inch,.27*inch,f'Page {doc.page}')
    canvas.restoreState()

doc.build(story,onFirstPage=footer,onLaterPages=footer)
print(OUT)
