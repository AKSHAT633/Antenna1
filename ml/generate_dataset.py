import pandas as pd
import random

data = []

for i in range(1000):
    freq = round(random.uniform(2.4, 5.0), 2)
    length = random.randint(30, 60)
    width = random.randint(25, 50)
    slot_length = random.randint(0, 5)
    slot_width = random.randint(0, 5)

    s11 = - (10 + (length + width)/10 + random.uniform(0, 10))

    data.append([freq, length, width, slot_length, slot_width, round(s11, 2)])

df = pd.DataFrame(data, columns=[
    "Freq(GHz)",
    "length of patch in mm",
    "width of patch in mm",
    "Slot length in mm",
    "slot width in mm",
    "s11(dB)"
])

df.to_csv("dataset_antenna.csv", index=False)

print("✅ Dataset generated (1000 rows)")