import numpy as np
import pandas as pd
import helmholtz as hz

# from helmholtz_mapping import HelmholtzMap as hzM
# db = hzM()
equi_df = pd.read_csv('table_equilibrium.csv')

np.set_printoptions(precision=5, suppress=True)

# Autoclave dimensions and test parameters
ID = 12 # inner diameter of vessel [cm]
H = 173 # height of vessel [cm]
h0 = 86 # initial water level [cm]
T0 = 20 # initial temperature [C]
T1 = 321 # test temperature [C]
R = 82 # gas constant [ml.atm/mol/K]
rho0 = 0.9982 # water density at 20C [g/cm3]
# P0 = 1.0 # initial Ar gas pressure [atm]
A = np.pi * ID * ID / 4 # area [cm2]

# density of water or steam fully filling the vessel [g/cm3]
rho_f = rho0 * h0 / H
print(f'rho_f = {rho_f:.4f} g/cm3')

# case 1: equilibrium state (initially empty vapor)
# Temperature increases from T0 (initial) to T1 (test temperature)
temperature = np.arange(T0, T1, 10)
density_of_water = []
density_of_steam = []
pressure_of_system = []
for T in temperature:
    if T < 374: # T_c = 373.946C
        idx = equi_df[equi_df['T'] == T].index[0]
        rho = equi_df.loc[idx, 'rho_w'] * 1000 # from equilibrium state
        varrho = equi_df.loc[idx, 'rho_s'] * 1000 # from equilibrium state
        pressure_atm = equi_df.loc[idx, 'P'] # from equilibrium state
    else:
        rho = np.nan
        varrho = rho_f * 1000
        pressure = hz.get_pressure(varrho, T)
        pressure_atm = pressure / 1.0e6 * 9.869
    density_of_water.append(rho)
    density_of_steam.append(varrho)
    pressure_of_system.append(pressure_atm)
density_of_water = np.array(density_of_water)
density_of_steam = np.array(density_of_steam)
pressure_of_system = np.array(pressure_of_system)

print(f'T = {temperature}')
# print(f'rho = {density_of_water}')
# print(f'varrho = {density_of_steam}')
# print(f'P = {pressure_of_system}')

# for water codition, minimum water height
# rho0 * h0(min) = varrho1 * H
if T1 < 374:
    varrho1 = density_of_steam[-1]/1000 # get density from equil for T
    h0_min = varrho1 * H / rho0
    print(f"Water minimum {h0_min:.1f} cm is required for operation in water condition.")

height = (rho0 * h0 - density_of_steam/1000 * H) / (density_of_water - density_of_steam) * 1000
# print(f'height = {height}')

for idx, h in enumerate(height):
    if h > H:
        print(f'event: full water at {temperature[idx]}C')
        height[idx] = H
        density_of_steam[idx] = rho_f * 1000
        density_of_water[idx] = rho_f * 1000
        pressure = hz.get_pressure(rho_f*1000, temperature[idx])
        pressure_of_system[idx] = pressure / 1.0e6 * 9.869
    elif h < 0:
        print(f'event: full steam {temperature[idx]}C')
        height[idx] = 0
        density_of_steam[idx] = rho_f * 1000
        density_of_water[idx] = np.nan
        pressure = hz.get_pressure(rho_f*1000, temperature[idx])
        pressure_of_system[idx] = pressure / 1.0e6 * 9.869
    else:
        pass #print("pass")

print(f'height = {height}')
print(f'rho = {density_of_water}')
print(f'varrho = {density_of_steam}')
print(f'P = {pressure_of_system}')
