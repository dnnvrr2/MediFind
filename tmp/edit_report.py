from pathlib import Path
p=Path('build_it314_report.py')
s=p.read_text(encoding='utf-8-sig')
s=s.replace("('Amba, Denver','Testing Coordinator','Coordinate test runs and keep the issue/retest record organized.')", "('Amba, Denver','Group Leader','Lead the testing effort, coordinate issue retests, consolidate evidence, and prepare the group submission.')")
s=s.replace("The names are from the Group 5 MediFind masterfile. These are proposed testing assignments; confirm and update them to reflect actual work.", "The names are from the Group 5 MediFind masterfile. The role assignments are proposed; update actual contribution details after each member completes the assigned work.")
p.write_text(s,encoding='utf-8')
