import Button from "./Button";

export default function WelcomeSection() {

    return(
    <section className='welcome-bck'>
        <h1 className="text-comp-club">Компю’терний клуб</h1>
        <p className="text-cyber-zone">CYBER ZONE</p>
        <p className="text-welcome-to-club">Welcome to the Club Buddy</p>
        <Button className="button-zabronuvatu">Забронювати</Button>
    </section> 
    )
}