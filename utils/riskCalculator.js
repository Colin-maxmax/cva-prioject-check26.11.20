// utils/riskCalculator.js
function calculateRisk(data) {
    let riskScore = 0;
    const riskFactors = [];

    // 1. 中风/脑缺血病史
    if (data.strokeHistory || data.tiaHistory) {
        riskScore += 40;
        if (data.strokeHistory) riskFactors.push('中风病史');
        if (data.tiaHistory) riskFactors.push('短暂性脑缺血病史');
    }

    // 2. 高血压病史
    if (data.hypertension) {
        riskScore += 25;
        riskFactors.push('高血压病史');
    }

    // 3. 心脏病史
    if (data.heartDisease) {
        riskScore += 20;
        riskFactors.push('心脏病史');
    }

    // 4. 糖尿病史（空腹血糖≥7.0）
    const hasDiabetes = data.avgGlucoseLevel >= 7.0;
    if (hasDiabetes) {
        riskScore += 18;
        riskFactors.push('糖尿病史');
    }

    // 5. 高血脂病史
    if (data.hyperlipidemia) {
        riskScore += 16;
        riskFactors.push('高血脂病史');
    }

    // 6. 脑卒中家族史
    if (data.strokeFamilyHistory !== '0') {
        riskScore += 10;
        const familyLevel = data.strokeFamilyHistory === '1' ? '一级亲属' : '二级亲属';
        riskFactors.push(`脑卒中家族史（${familyLevel}）`);
    }

    // 7. 血压分级
    const { systolicBP, diastolicBP } = data;
    if (systolicBP >= 180 || diastolicBP >= 110) {
        riskScore += 15;
        if (!data.hypertension) riskFactors.push('重度高血压');
    } else if (systolicBP >= 160 || diastolicBP >= 100) {
        riskScore += 10;
        if (!data.hypertension) riskFactors.push('中度高血压');
    } else if (systolicBP >= 140 || diastolicBP >= 90) {
        riskScore += 7;
        if (!data.hypertension) riskFactors.push('轻度高血压');
    } else if (systolicBP >= 130 || diastolicBP >= 85) {
        riskScore += 3;
    }

    // 8. 高血压合并因素
    if (data.hypertension && data.age >= 40) {
        riskScore += 4;
        riskFactors.push('中年高血压');
    }
    if (data.hypertension && (data.smokingStatus === '目前吸烟' || data.smokingStatus === '以前吸烟')) {
        riskScore += 3;
        riskFactors.push('高血压合并吸烟');
    }

    // 9. 血糖分级
    if (!hasDiabetes) {
        if (data.avgGlucoseLevel >= 11.1) {
            riskScore += 6;
            riskFactors.push('严重高血糖');
        } else if (data.avgGlucoseLevel >= 7.0) {
            riskScore += 4;
            riskFactors.push('糖尿病');
        } else if (data.avgGlucoseLevel >= 6.1) {
            riskScore += 2;
            riskFactors.push('糖尿病前期');
        } else if (data.avgGlucoseLevel >= 5.6) {
            riskScore += 1;
        } else if (data.avgGlucoseLevel < 3.9) {
            riskScore += 3;
            riskFactors.push('低血糖');
        }
    }

    // 10. BMI
    if (data.bmi) {
        if (data.bmi >= 28) {
            riskScore += 12;
            riskFactors.push('肥胖（BMI≥28）');
        } else if (data.bmi >= 24) {
            riskScore += 8;
            riskFactors.push('超重（BMI 24-27.9）');
        } else if (data.bmi < 18.5) {
            riskScore += 2;
            riskFactors.push('体重偏瘦');
        }
    }

    // 11. 吸烟
    if (data.smokingStatus === '目前吸烟') {
        riskScore += 10;
        riskFactors.push('目前吸烟');
    } else if (data.smokingStatus === '以前吸烟') {
        riskScore += 4;
        riskFactors.push('以前吸烟');
    }

    // 12. 运动缺乏
    const lackOfExercise = data.exerciseFrequency === '无运动' || data.exerciseFrequency === '少量运动' ||
                           data.age > 50 || (data.workType === '政府工作' || data.workType === '从未工作');
    if (lackOfExercise) {
        riskScore += 8;
        riskFactors.push('运动缺乏');
    }

    // 13. 饮酒
    if (data.drinkingStatus === '经常饮酒' || data.drinkingStatus === '过量饮酒') {
        riskScore += 6;
        riskFactors.push('经常饮酒');
    }

    // 14. 不健康膳食
    if (data.hasUnhealthyDiet) {
        riskScore += 4;
        riskFactors.push('不健康膳食');
    }
    if (data.dietaryHabits && data.dietaryHabits.length > 0) {
        riskFactors.push(...data.dietaryHabits.filter(h => h !== '均衡'));
    }

    // 15. 年龄
    if (data.age >= 75) riskScore += 10;
    else if (data.age >= 65) riskScore += 8;
    else if (data.age >= 55) riskScore += 6;
    else if (data.age >= 45) riskScore += 4;
    else if (data.age >= 35) riskScore += 2;

    // 16. 性别
    if (data.gender === '男') riskScore += 1;

    // 17. 社会因素
    if (data.everMarried === '否') riskScore += 0.5;
    if (data.workType === '私营' || data.workType === '个体经营') riskScore += 0.5;
    if (data.residenceType === '农村') riskScore += 0.5;

    // 风险等级
    const normalizedScore = Math.min(riskScore, 100);
    let riskLevel, probability;
    if (normalizedScore >= 60) {
        riskLevel = '高风险';
        probability = 0.5 + (normalizedScore - 60) * 0.01;
    } else if (normalizedScore >= 40) {
        riskLevel = '中风险';
        probability = 0.15 + (normalizedScore - 40) * 0.0175;
    } else if (normalizedScore >= 20) {
        riskLevel = '低风险';
        probability = 0.02 + (normalizedScore - 20) * 0.0065;
    } else {
        riskLevel = '极低风险';
        probability = 0.01;
    }
    probability = Math.min(probability, 0.9834);
    const probabilityPercent = (probability * 100).toFixed(1);

    return {
        riskScore: Math.round(riskScore * 10) / 10,
        riskLevel,
        probability: probabilityPercent,
        riskFactors
    };
}

module.exports = { calculateRisk };