// Offline marketing composition using the app's existing art. No UI automation or live user data.
// swift render_promo.swift <landscape-zh|landscape-en|portrait> <png|raw> <output.png|-> [fps]
import AppKit

let format = CommandLine.arguments[1], mode = CommandLine.arguments[2], output = CommandLine.arguments[3]
let fps = CommandLine.arguments.count > 4 ? Int(CommandLine.arguments[4])! : 20
let portrait = format == "portrait", english = format == "landscape-en", officeOnly = format == "office", avatarOnly = format == "avatar"
let width = avatarOnly ? 184:officeOnly ? 1448 : portrait ? 1080 : 1920, height = avatarOnly ? 204:officeOnly ? 1086 : portrait ? 1920 : 1080
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let assets = root.appendingPathComponent("web/public/assets")
let layout = try JSONSerialization.jsonObject(with: Data(contentsOf: assets.appendingPathComponent("layout.json"))) as! [String: Any]
let seats = layout["seats"] as! [[String: Any]], foregrounds = layout["foregrounds"] as! [[String: Any]]
let boundary = layout["boundary"] as! [[Double]], spots = layout["spots"] as! [String: Any]
let navigation = layout["navigation"] as! [String: Any]
let nodes = (navigation["nodes"] as! [[Double]]).map { $0.map { $0 * 50 } }
let next = navigation["next"] as! [[Int]]
let names = ["小瓜", "小甜", "小籽", "阿瓜", "小皮"]
let casts = ["gua", "tian", "zi", "agua", "pi", "boss"]
let mint = NSColor(srgbRed:0.718,green:0.929,blue:0.808,alpha:1)
let cream = NSColor(srgbRed:0.957,green:0.953,blue:0.929,alpha:1)
let muted = NSColor(srgbRed:0.60,green:0.68,blue:0.63,alpha:1)
let yellow = NSColor(srgbRed:0.965,green:0.824,blue:0.49,alpha:1)
let background = NSColor(srgbRed:0.031,green:0.039,blue:0.035,alpha:1)
let room = NSImage(contentsOf: assets.appendingPathComponent("illustration/office.png"))!
let working = NSBitmapImageRep(data: try Data(contentsOf: assets.appendingPathComponent("illustration/working.png")))!.cgImage!
var frames: [String: [NSImage]] = [:], workFrames: [String: [NSImage]] = [:]
for (index, cast) in casts.enumerated() {
    let source = NSBitmapImageRep(data: try Data(contentsOf: assets.appendingPathComponent("illustration/\(cast).png")))!.cgImage!
    frames[cast] = (0..<18).map { i in
        let left = i % 6 * source.width / 6, right = (i % 6 + 1) * source.width / 6
        let top = i / 6 * source.height / 3, bottom = (i / 6 + 1) * source.height / 3
        let image = source.cropping(to:CGRect(x:left,y:top,width:right-left,height:bottom-top))!
        return NSImage(cgImage:image,size:NSSize(width:104,height:156))
    }
    workFrames[cast] = (0..<2).map { row in
        let image = working.cropping(to:CGRect(x:index*working.width/6,y:row*working.height/2,width:working.width/6,height:working.height/2))!
        return NSImage(cgImage:image,size:NSSize(width:104,height:156))
    }
}
let tian = frames["tian"]![0].cgImage(forProposedRect:nil,context:nil,hints:nil)!
let faceImage = tian.cropping(to:CGRect(x:Double(tian.width)*0.18,y:Double(tian.height)*0.24,width:Double(tian.width)*0.64,height:Double(tian.height)*0.48))!
let badgeFace = NSImage(cgImage:faceImage,size:NSSize(width:80,height:90))
let bitmap = NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:width,pixelsHigh:height,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:width*4,bitsPerPixel:32)!
let graphics = NSGraphicsContext(bitmapImageRep:bitmap)!
func rect(_ x:Double,_ y:Double,_ w:Double,_ h:Double)->NSRect { NSRect(x:x,y:Double(height)-y-h,width:w,height:h) }
func fill(_ x:Double,_ y:Double,_ w:Double,_ h:Double,_ color:NSColor,_ radius:Double=0) {
    color.setFill(); NSBezierPath(roundedRect:rect(x,y,w,h),xRadius:radius,yRadius:radius).fill()
}
func line(_ x:Double,_ y:Double,_ w:Double) { fill(x,y,w,1,NSColor(white:0.2,alpha:1)) }
func font(_ size:Double,_ bold:Bool=false)->NSFont {
    NSFont(name:english ? (bold ? "HelveticaNeue-Bold" : "HelveticaNeue") : (bold ? "PingFangSC-Semibold" : "PingFangSC-Regular"),size:size)!
}
func text(_ value:String,_ x:Double,_ y:Double,_ size:Double,_ color:NSColor=cream,_ bold:Bool=false,_ maxWidth:Double=1800) {
    let paragraph=NSMutableParagraphStyle(); paragraph.lineSpacing=size*0.18
    let attr=NSAttributedString(string:value,attributes:[.font:font(size,bold),.foregroundColor:color,.paragraphStyle:paragraph])
    let bounds=attr.boundingRect(with:NSSize(width:maxWidth,height:1000),options:[.usesLineFragmentOrigin,.usesFontLeading])
    attr.draw(with:rect(x,y,maxWidth,ceil(bounds.height)),options:[.usesLineFragmentOrigin,.usesFontLeading])
}
func image(_ value:NSImage,_ x:Double,_ y:Double,_ w:Double,_ h:Double) { value.draw(in:rect(x,y,w,h),from:.zero,operation:.sourceOver,fraction:1) }
func path(_ points:[[Double]],_ x:Double,_ y:Double,_ scale:Double)->NSBezierPath {
    let p=NSBezierPath()
    for (i,point) in points.enumerated() {
        let at=NSPoint(x:x+point[0]*scale,y:Double(height)-y-point[1]*scale)
        if i==0 { p.move(to:at) } else { p.line(to:at) }
    }
    p.close(); return p
}
func bubble(_ name:String,_ message:String,_ px:Double,_ py:Double,_ time:Double,_ working:Bool=false,_ warning:Bool=false,scale:Double) {
    let name = english ? (["小瓜":"Gua","小甜":"Tian","小籽":"Zi","阿瓜":"Agua","小皮":"Pi","瓜老板（你）":"Boss (you)"][name] ?? name):name
    let message = english ? (["工作中":"Working","带薪喝咖啡":"Paid coffee break","行政猫，来贴贴":"Cat time.","老板，签个字":"Need approval","交付了，先去喝咖啡":"Shipped. Coffee?","在改了在改了":"Looking busy","你的抓手呢？":"Where's the leverage?"][message] ?? message):message
    let size=21*scale, pad=12*scale
    let nf=font(size,true), mf=font(23*scale)
    let nw=(name as NSString).size(withAttributes:[.font:nf]).width + 18*scale
    let mw=(message as NSString).size(withAttributes:[.font:mf]).width
    let w=nw+mw+pad*3+(working ? 38*scale : 0), h=48*scale
    let x=px-w/2, y=py-h-12*scale
    fill(x,y+5*scale,w,h,NSColor(white:0,alpha:0.2),14*scale)
    fill(x,y,w,h,warning ? NSColor(srgbRed:1,green:0.94,blue:0.79,alpha:1):.white,14*scale)
    let tail=path([[px-9*scale,py-13*scale],[px+9*scale,py-13*scale],[px,py]],0,0,1)
    (warning ? NSColor(srgbRed:1,green:0.94,blue:0.79,alpha:1):.white).setFill(); tail.fill()
    fill(x+pad,y+8*scale,nw,h-16*scale,warning ? yellow:NSColor(srgbRed:0.86,green:0.95,blue:0.9,alpha:1),3*scale)
    text(name,x+pad+9*scale,y+10*scale,size,NSColor(srgbRed:0.17,green:0.34,blue:0.24,alpha:1),true,nw)
    text(message,x+pad*2+nw,y+8*scale,23*scale,NSColor(white:0.14,alpha:1),false,mw+2)
    if working {
        for i in 0..<3 {
            let dy=max(0,sin(time*7-Double(i)*0.8))*4*scale
            fill(x+pad*2+nw+mw+10*scale+Double(i)*10*scale,y+23*scale-dy,4*scale,4*scale,NSColor(srgbRed:0.25,green:0.57,blue:0.4,alpha:1),2*scale)
        }
    }
}
// Use the actual aisle graph, so employees and the boss never walk through desks or glass walls.
func walk(_ from:[Double],_ to:[Double],_ progress:Double)->[Double] {
    func nearest(_ p:[Double])->Int { nodes.indices.min{hypot(nodes[$0][0]-p[0],nodes[$0][1]-p[1]) < hypot(nodes[$1][0]-p[0],nodes[$1][1]-p[1])}! }
    let start=nearest(from),end=nearest(to)
    var points=[from,nodes[start]],current=start
    while current != end {current=next[current][end];points.append(nodes[current])}
    points.append(to)
    let distances=points.indices.dropFirst().map{hypot(points[$0][0]-points[$0-1][0],points[$0][1]-points[$0-1][1])}
    var remaining=distances.reduce(0,+)*progress
    for (i,d) in distances.enumerated() {
        if remaining <= d && d > 0 {return [points[i][0]+(points[i+1][0]-points[i][0])*remaining/d,points[i][1]+(points[i+1][1]-points[i][1])*remaining/d]}
        remaining -= d
    }
    return to
}
func roomScene(_ time:Double,_ phase:Int,_ local:Double) {
    let scale=officeOnly ? 1:portrait ? 0.755:0.815, x=officeOnly ? 0:portrait ? -7.0:718.0, y=officeOnly ? 0:portrait ? 565.0:140.0
    var layers:[(Double,()->Void)]=[]
    layers.append((0,{
        NSGraphicsContext.saveGraphicsState(); path(boundary,x,y,scale).addClip(); image(room,x,y,1448*scale,1086*scale); NSGraphicsContext.restoreGraphicsState()
    }))
    for foreground in foregrounds {
        let points=foreground["points"] as! [[Double]], depth=foreground["depth"] as! Double
        layers.append((depth,{
            NSGraphicsContext.saveGraphicsState(); path(points,x,y,scale).addClip(); image(room,x,y,1448*scale,1086*scale); NSGraphicsContext.restoreGraphicsState()
        }))
    }
    var bubbles:[()->Void]=[]
    for i in 0..<5 {
        let seat=seats[i], anchor=seat["anchor"] as! [Double]
        var position=anchor, typing=i<3, message="工作中", warning=false
        let frame=Int(time*5)%2
        var sprite=workFrames[casts[i]]![frame]
        if i==3 { position=[1160,700]; typing=false; message="带薪喝咖啡"; sprite=frames[casts[i]]![8+Int(time*2)%2] }
        if i==4 { position=[315,730]; typing=false; message="行政猫，来贴贴"; sprite=frames[casts[i]]![14+Int(time*2)%2] }
        if phase==1 && i==0 { typing=false; warning=true; message="老板，签个字"; sprite=frames[casts[i]]![2+Int(time*3)%2] }
        if phase==2 && i<3 {
            let start=anchor, destinations=[[1230.0,710.0],[1270,735],[1170,845]], end=destinations[i]
            let progress=min(1,max(0,local/3.7))
            position=walk(start,end,progress)
            typing=false; message=progress<1 ? "交付了，先去喝咖啡":"带薪喝咖啡"
            sprite=frames[casts[i]]![progress<1 ? 6+Int(time*7)%2:8+Int(time*2)%2]
        }
        if phase==3 {
            typing=false; message="在改了在改了"
            let starts=[[1230.0,710.0],[1270,735],[1170,845],[1160,700],[315,730]],progress=min(1,local/2.7)
            position=walk(starts[i],anchor,progress)
            sprite=progress<1 ? frames[casts[i]]![6+Int(time*7)%2]:workFrames[casts[i]]![frame]
        }
        let at=position, chosen=sprite
        layers.append((at[1]+1,{ image(chosen,x+(at[0]-52)*scale,y+(at[1]-146.64)*scale,104*scale,156*scale) }))
        let msg=message,isWork=typing,warn=warning
        // Keep the office legible in a small social feed: only three story bubbles at a time.
        if i<2 || i==4 { bubbles.append { bubble(names[i],msg,x+at[0]*scale,y+(at[1]-128-Double(i%2)*50)*scale,time,isWork,warn,scale:scale) } }
    }
    var boss=spots["boss"] as! [Double]; boss=boss.map{$0*50}
    var bossFrame=frames["boss"]![0]
    if phase==3 {
        let progress=min(1,local/3), target=[525.0,555.0]
        boss=walk(boss,target,progress)
        bossFrame=frames["boss"]![progress<1 ? 6+Int(time*7)%2:16+Int(time*4)%2]
    }
    let bp=boss, bf=bossFrame
    layers.append((bp[1]+1,{ image(bf,x+(bp[0]-52)*scale,y+(bp[1]-146.64)*scale,104*scale,156*scale) }))
    for layer in layers.sorted(by:{$0.0<$1.0}) { layer.1() }
    for draw in bubbles { draw() }
    if phase==3 { bubble("瓜老板（你）","你的抓手呢？",x+bp[0]*scale,y+(bp[1]-160)*scale,time,false,true,scale:scale) }
    // Cover only the blank clock face and place the story time with the room's wall perspective.
    NSGraphicsContext.saveGraphicsState()
    graphics.cgContext.concatenate(CGAffineTransform(a:1,b:0.55,c:0,d:1,tx:x+618*scale,ty:Double(height)-y-157*scale))
    let clock=NSAttributedString(string:"03:00",attributes:[.font:NSFont.monospacedDigitSystemFont(ofSize:24*scale,weight:.semibold),.foregroundColor:mint])
    clock.draw(at:NSPoint(x:3,y:-25*scale)); NSGraphicsContext.restoreGraphicsState()
}
func employeeBadge(_ x:Double,_ y:Double,_ scale:Double,_ phase:Int) {
    let ink=NSColor(srgbRed:0.16,green:0.16,blue:0.21,alpha:1), secondary=NSColor(white:0.48,alpha:1)
    func box(_ dx:Double,_ dy:Double,_ w:Double,_ h:Double,_ color:NSColor,_ radius:Double=0) { fill(x+dx*scale,y+dy*scale,w*scale,h*scale,color,radius*scale) }
    func label(_ s:String,_ dx:Double,_ dy:Double,_ size:Double,_ color:NSColor,_ bold:Bool=false,_ maxW:Double=230) { text(s,x+dx*scale,y+dy*scale,size*scale,color,bold,maxW*scale) }
    box(4,14,260,410,NSColor(white:0,alpha:0.35),20)
    box(0,0,260,410,NSColor(srgbRed:0.98,green:0.976,blue:0.961,alpha:1),20)
    box(109,10,42,10,ink,5); box(119,-16,22,34,mint,5)
    label("MELON OFFICE",20,36,10,secondary,true)
    label(english ? "EMPLOYEE FILE":"员工档案",164,36,11,ink,true,84)
    box(20,61,220,1,NSColor(white:0.84,alpha:1))
    box(20,78,92,102,NSColor(srgbRed:0.85,green:0.93,blue:0.98,alpha:1),11)
    image(badgeFace,x+20*scale,y+78*scale,92*scale,102*scale)
    label(english ? "Tian":"小甜",128,78,32,ink,true,115)
    label(english ? "QA · P5":"测试 · P5",130,120,12,secondary)
    box(129,144,62,23,NSColor(srgbRed:0.88,green:0.90,blue:0.94,alpha:1),5)
    label("Codex",138,148,11,ink)
    let work=NSColor(srgbRed:0.16,green:0.38,blue:0.27,alpha:1)
    box(20,198,220,32,NSColor(srgbRed:0.88,green:0.95,blue:0.9,alpha:1),8)
    box(33,211,7,7,work,3.5)
    label(english ? (phase==2 ? "Waiting for review":"On duty · Working"):(phase==2 ? "等待验收":"在岗 · 工作中"),49,207,12,work,true,187)
    label(english ? "PROJECT":"当前项目",20,246,10,secondary)
    label("melon-office",119,242,13,ink,true,121)
    label(english ? "ON DUTY":"本次在岗",20,273,10,secondary)
    label(english ? "18 min":"18 分钟",178,269,12,ink,true,65)
    box(20,303,220,61,NSColor(srgbRed:0.89,green:0.95,blue:0.92,alpha:1),9)
    label(english ? "⌘ CURRENT TASK":"⌘ 正在做什么",30,313,10,work,true,200)
    label(english ? "Running tests. Checking states.":"运行测试，检查状态切换",30,335,11,ink,false,201)
    label(english ? "Resident · Melon Office":"常驻员工 · 甜瓜科技",20,382,8,secondary)
    for i in 0..<18 {box(192+Double(i)*2.6,380,i%3==0 ? 1.8:0.8,14,secondary)}
}
let zhTitle=[("我给 AI 员工","建了个工位。"),("AI 要权限，","也得找老板签字。"),("活刚干完，","它先去撸猫了。"),("老板一来，","全员假装很忙。")]
let zhSub=["Claude Code 和 Codex，一起进厂打工。","不用翻终端，举手就知道谁在等你。","办公室里最不卷的，果然是这只猫。","职场默契，这下连 AI 都学会了。"]
let enChapter=["01 / TEAM ONLINE","02 / BOSS, SIGN HERE","03 / SHIPPED. BREAK TIME.","04 / LOOK BUSY."]
let enSub=["Claude Code + Codex.\nOne tiny office.","Permission needed?\nThe boss has to sign.","The task is done.\nThe coffee is paid.","Boss incoming.\nEveryone back to work."]
func render(_ time:Double) {
    NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current=graphics
    fill(0,0,Double(width),Double(height),background)
    let phase=min(3,Int(time/5)),local=time-Double(phase)*5
    if avatarOnly {
        fill(0,0,Double(width),Double(height),NSColor(srgbRed:0.85,green:0.93,blue:0.98,alpha:1))
        image(badgeFace,0,0,Double(width),Double(height));NSGraphicsContext.restoreGraphicsState();return
    }
    if officeOnly {roomScene(time,0,time);NSGraphicsContext.restoreGraphicsState();return}
    if portrait {
        text("melon office",64,62,30,mint,true)
        text("甜瓜科技 · AI 事业部",630,70,20,muted)
        line(64,124,952)
        text("我的 AI 员工，入职大厂了。",64,170,24,yellow)
        text(zhTitle[phase].0,64,232,76,cream,true,970)
        text(zhTitle[phase].1,64,332,76,mint,true,970)
        text(zhSub[phase],68,458,28,muted,false,940)
        text("演示剧情 · 非实时会话",66,532,15,muted)
        roomScene(time,phase,local)
        employeeBadge(738,948,1.02,phase)
        fill(64,1455,952,2,NSColor(white:0.18,alpha:1))
        text(String(format:"0%d",phase+1),64,1500,44,yellow,true)
        text(["一人一个工位，谁忙一眼就懂。","老板签字，员工继续开工。","任务有交付，摸鱼也有仪式感。","你负责想法，他们负责加班。"][phase],155,1510,31,cream,true,850)
        text("Claude Code  ×  Codex",64,1630,27,mint)
        for i in 0..<4 { fill(64+Double(i)*242,1720,222,4,i<phase ? mint:i==phase ? mint.withAlphaComponent(0.6):NSColor(white:0.2,alpha:1),2) }
        text("Melon Office",64,1790,25,cream,true)
        text("老板是你。猫也是你的同事。",530,1798,21,muted)
    } else {
        text("melon office",96,60,30,mint,true)
        text(english ? "BY MELONKID":"甜瓜科技出品",340,70,12,muted)
        text("03:00  /  STILL SHIPPING",1510,75,13,yellow)
        line(96,118,1728)
        text(english ? "THE AI DEPARTMENT IS NOW OPEN":"AI 事业部 · 今日正式开工",96,188,14,mint,true)
        text(english ? "I hired AI.":"我的 AI 员工，",92,252,english ? 90:76,cream,true,710)
        text(english ? "They took breaks.":"入职大厂了。",92,370,english ? 72:76,mint,true,710)
        text(english ? "They code. They ask for approval.\nThen they sneak off for coffee.":"代码照写，班照加。\n有事举手，没事摸鱼。",98,496,25,muted,false,620)
        fill(96,646,565,142,NSColor(srgbRed:0.07,green:0.12,blue:0.085,alpha:1),12)
        let staticTitle=english ? "A DESK. A BADGE. A LITTLE PERSONALITY.":"AI 员工入职指南"
        let chapter=english ? enChapter[phase]:["01 / 开工了，老板。","02 / 老板，签个字。","03 / 交付完，带薪撸猫。","04 / 老板来了，假装很忙。"][phase]
        text(mode=="png" ? staticTitle:chapter,118,668,14,yellow,true,510)
        text(mode=="png" ? (english ? "A desk, a badge, a boss.\nAnd a cat for good measure.":"有工位，有工卡，有老板。\n还有猫，和带薪摸鱼。"):(english ? enSub[phase]:zhSub[phase]),118,703,22,cream,false,510)
        fill(96,838,english ? 305:285,64,mint,8)
        text(english ? "Meet your AI team  ↗":"领走你的 AI 员工  ↗",118,854,23,background,true,330)
        text("Claude Code   ×   Codex",96,937,19,muted)
        text(english ? "SCRIPTED DEMO · NOT LIVE":"演示剧情 · 非实时会话",1480,132,11,muted)
        roomScene(time,phase,local)
        employeeBadge(1574,466,1,phase)
        text(english ? "Every agent gets a badge.":"每位 AI，都有自己的工卡。",1518,912,16,mint,true,350)
        line(96,1000,1728)
        text("github.com/imelonkid/melon-office",96,1026,14,muted)
        text(english ? "A tiny office. A little corporate humor.":"一间小办公室，一点大厂幽默。",1340,1026,14,muted)
    }
    NSGraphicsContext.restoreGraphicsState()
}
let count=mode=="png" ? 1:fps*20
for frame in 0..<count {
    autoreleasepool {
        render(mode=="png" ? (portrait ? 11.5:1.2):Double(frame)/Double(fps))
        if mode=="png" { try! bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:output)) }
        else { FileHandle.standardOutput.write(Data(bytes:bitmap.bitmapData!,count:bitmap.bytesPerRow*height)) }
    }
}
